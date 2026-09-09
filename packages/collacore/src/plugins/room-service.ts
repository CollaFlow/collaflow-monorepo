import type { FastifyInstance } from 'fastify';
import { RoomService } from '../modules/room/service';

declare module 'fastify' {
  interface FastifyInstance {
    roomService: RoomService;
  }
}

/**
 * 注册 RoomService。
 */
export async function roomServicePlugin(app: FastifyInstance): Promise<void> {
  const roomService = new RoomService(app.messageBus);
  app.decorate('roomService', roomService);
  app.log.info('RoomService plugin registered');
}
