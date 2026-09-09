import fastifyWebsocket from '@fastify/websocket';
import type { FastifyInstance } from 'fastify';

/**
 * 注册 WebSocket 支持。
 * 当前为占位实现，后续在 room 模块中注册具体 WS 路由。
 */
export async function websocketPlugin(app: FastifyInstance): Promise<void> {
  await app.register(fastifyWebsocket, {
    options: {
      maxPayload: 1048576, // 1MB
    },
  });

  app.log.info('WebSocket plugin registered');
}
