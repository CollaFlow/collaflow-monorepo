import type { Redis } from 'ioredis';

/**
 * 消息总线抽象。
 *
 * 当前 MVP 使用 Redis Pub/Sub 实现，未来可替换为 NATS / Kafka / RabbitMQ。
 */
export interface MessageBus {
  /**
   * 发布消息到指定频道。
   */
  publish(channel: string, message: Uint8Array | string): Promise<void>;

  /**
   * 订阅指定频道的消息。
   */
  subscribe(channel: string, handler: (message: Uint8Array) => void): Promise<void>;

  /**
   * 取消订阅指定频道。
   */
  unsubscribe(channel: string): Promise<void>;

  /**
   * 关闭连接。
   */
  close(): Promise<void>;
}

/**
 * 基于 Redis Pub/Sub 的消息总线实现。
 *
 * 注意：Redis Pub/Sub 不保证消息持久化，仅用于实时广播。
 */
export class RedisMessageBus implements MessageBus {
  private publisher: Redis;
  private subscriber: Redis;
  private handlers = new Map<string, Set<(message: Uint8Array) => void>>();

  constructor(redis: Redis) {
    // 使用同一个 Redis 连接池创建 publisher 和 subscriber
    this.publisher = redis;
    this.subscriber = redis.duplicate();

    this.subscriber.on('messageBuffer', (channelBuffer: Buffer, messageBuffer: Buffer) => {
      const channel = channelBuffer.toString('utf-8');
      const handlers = this.handlers.get(channel);
      if (!handlers) return;

      const message = new Uint8Array(messageBuffer);
      handlers.forEach((handler) => {
        try {
          handler(message);
        } catch (err) {
          // 消费者错误不应影响总线
          console.error('Message handler error:', err);
        }
      });
    });
  }

  async publish(channel: string, message: Uint8Array | string): Promise<void> {
    const buffer = typeof message === 'string' ? Buffer.from(message, 'utf-8') : Buffer.from(message);
    await this.publisher.publish(channel, buffer);
  }

  async subscribe(channel: string, handler: (message: Uint8Array) => void): Promise<void> {
    let handlers = this.handlers.get(channel);
    if (!handlers) {
      handlers = new Set();
      this.handlers.set(channel, handlers);
      await this.subscriber.subscribe(channel);
    }
    handlers.add(handler);
  }

  async unsubscribe(channel: string): Promise<void> {
    this.handlers.delete(channel);
    await this.subscriber.unsubscribe(channel);
  }

  async close(): Promise<void> {
    this.handlers.clear();
    await this.subscriber.unsubscribe();
    await this.subscriber.quit();
  }
}

interface InMemoryHandler {
  instanceId: string;
  handler: (message: Uint8Array) => void;
}

/**
 * 内存消息总线，用于测试或无 Redis 环境。
 *
 * 多个 InMemoryMessageBus 实例可共享同一个 registry 来模拟多实例场景。
 * 发布给总线的消息不会回传给同一实例的订阅者。
 */
export class InMemoryMessageBus implements MessageBus {
  private instanceId: string;
  private registry: Map<string, Set<InMemoryHandler>>;

  constructor(instanceId?: string, registry?: Map<string, Set<InMemoryHandler>>) {
    this.instanceId = instanceId ?? `instance-${Math.random().toString(36).slice(2, 9)}`;
    this.registry = registry ?? new Map();
  }

  async publish(channel: string, message: Uint8Array | string): Promise<void> {
    const handlers = this.registry.get(channel);
    if (!handlers) return;

    const data = typeof message === 'string' ? new TextEncoder().encode(message) : message;
    handlers.forEach(({ instanceId, handler }) => {
      // 不回传给同一实例的订阅者
      if (instanceId === this.instanceId) return;
      try {
        handler(data);
      } catch (err) {
        console.error('Message handler error:', err);
      }
    });
  }

  async subscribe(channel: string, handler: (message: Uint8Array) => void): Promise<void> {
    let handlers = this.registry.get(channel);
    if (!handlers) {
      handlers = new Set();
      this.registry.set(channel, handlers);
    }
    handlers.add({ instanceId: this.instanceId, handler });
  }

  async unsubscribe(channel: string): Promise<void> {
    const handlers = this.registry.get(channel);
    if (!handlers) return;

    for (const item of handlers) {
      if (item.instanceId === this.instanceId) {
        handlers.delete(item);
      }
    }

    if (handlers.size === 0) {
      this.registry.delete(channel);
    }
  }

  async close(): Promise<void> {
    for (const [channel, handlers] of this.registry) {
      for (const item of handlers) {
        if (item.instanceId === this.instanceId) {
          handlers.delete(item);
        }
      }
      if (handlers.size === 0) {
        this.registry.delete(channel);
      }
    }
  }

  /**
   * 创建一个共享 registry 的新实例，用于模拟多实例环境。
   */
  createPeer(instanceId?: string): InMemoryMessageBus {
    return new InMemoryMessageBus(instanceId, this.registry);
  }
}
