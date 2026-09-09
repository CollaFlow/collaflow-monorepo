import type { FastifyInstance } from 'fastify';

/**
 * 房间 REST 路由。
 *
 * MVP 阶段仅提供加入房间的入口信息，实际协同连接通过 WebSocket 建立。
 */
export async function roomRoutes(app: FastifyInstance): Promise<void> {
  app.post('/rooms/:roomId/join', async (request, reply) => {
    const { roomId } = request.params as { roomId: string };
    const { userId } = request.query as { userId?: string };

    if (!userId) {
      return reply.status(400).send({ error: 'userId is required' });
    }

    const room = app.roomService.getRoom(roomId);

    return {
      roomId,
      userId,
      websocketUrl: `/ws/rooms/${roomId}?userId=${userId}`,
      currentUsers: room?.users ?? [],
    };
  });

  app.get('/rooms/:roomId', async (request, reply) => {
    const { roomId } = request.params as { roomId: string };
    const room = app.roomService.getRoom(roomId);

    if (!room) {
      return reply.status(404).send({ error: 'room not found' });
    }

    return room;
  });
}
