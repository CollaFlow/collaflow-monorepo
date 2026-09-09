import Redis from 'ioredis';
import type { FastifyInstance } from 'fastify';
import { RedisMessageBus, type MessageBus } from '../infrastructure/message-bus';
import { config } from '../config';

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis;
    messageBus: MessageBus;
  }
}

export interface RedisPluginOptions {
  messageBus?: MessageBus;
}

/**
 * 注册 Redis 连接和消息总线。
 *
 * 测试环境可通过 options.messageBus 注入 InMemoryMessageBus，避免依赖真实 Redis。
 */
export async function redisPlugin(app: FastifyInstance, options: RedisPluginOptions = {}): Promise<void> {
  if (options.messageBus) {
    app.decorate('messageBus', options.messageBus);
    app.log.info('MessageBus injected (Redis skipped)');
    return;
  }

  const redis = new Redis(config.redisUrl, {
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    maxRetriesPerRequest: 3,
  });

  const messageBus = new RedisMessageBus(redis);

  app.decorate('redis', redis);
  app.decorate('messageBus', messageBus);

  app.addHook('onClose', async () => {
    await messageBus.close();
    await redis.quit();
  });

  app.log.info('Redis plugin registered');
}
