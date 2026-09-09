import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { config } from './config';
import { websocketPlugin } from './plugins/websocket';
import { redisPlugin } from './plugins/redis';
import { roomServicePlugin } from './plugins/room-service';
import { roomRoutes } from './modules/room/routes';
import { roomWebSocketRoutes } from './modules/room/websocket';
import type { MessageBus } from './infrastructure/message-bus';

export interface CreateServerOptions {
  logger?: boolean;
  messageBus?: MessageBus;
}

export async function createServer(options: CreateServerOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ?? {
      level: config.logLevel,
    },
  });

  // 注册 Redis 和消息总线（测试可注入 MessageBus）
  await app.register(redisPlugin, { messageBus: options.messageBus });

  // 注册 WebSocket 支持
  await app.register(websocketPlugin);

  // 注册房间服务
  await app.register(roomServicePlugin);

  // 注册房间 REST 和 WebSocket 路由
  await app.register(roomRoutes);
  await app.register(roomWebSocketRoutes);

  // 健康检查
  app.get('/health', async () => {
    return { status: 'ok', timestamp: Date.now() };
  });

  // 优雅关闭
  app.addHook('onClose', async () => {
    app.log.info('CollaCore server is closing');
  });

  return app;
}
