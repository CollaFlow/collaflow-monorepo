import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { SocketStream } from '@fastify/websocket';
import { parseRoomMessage, buildRoomMessage, getRoomMessageTypeName } from './protocol';

/**
 * 房间 WebSocket 路由。
 *
 * 路径：/ws/rooms/:roomId?userId=xxx
 *
 * 消息协议：
 * - 0x00 + Yjs update payload
 * - 0x01 + Yjs awareness payload
 */
export async function roomWebSocketRoutes(app: FastifyInstance): Promise<void> {
  app.get('/ws/rooms/:roomId', { websocket: true }, async (connection: SocketStream, req: FastifyRequest) => {
    const { roomId } = req.params as { roomId: string };
    const { userId } = req.query as { userId?: string };

    if (!userId) {
      connection.socket.close(1008, 'userId is required');
      return;
    }

    const socket = connection.socket;

    app.log.info(`User ${userId} joining room ${roomId}`);

    // 加入房间
    await app.roomService.join(roomId, {
      userId,
      send: (data) => {
        if (socket.readyState === 1) {
          socket.send(data);
        }
      },
    });

    // 接收消息并广播
    socket.on('message', async (raw: Buffer) => {
      let message;
      try {
        message = parseRoomMessage(new Uint8Array(raw));
      } catch (err) {
        app.log.warn({ roomId, userId }, 'Invalid room message');
        return;
      }

      app.log.debug(
        { roomId, userId, type: getRoomMessageTypeName(message.type) },
        'Broadcasting room message'
      );

      // 重新打包并广播（保留消息类型前缀）
      const broadcastData = buildRoomMessage(message.type, message.payload);
      await app.roomService.broadcast(roomId, userId, broadcastData);
    });

    // 连接关闭时离开房间
    socket.on('close', async () => {
      app.log.info(`User ${userId} left room ${roomId}`);
      await app.roomService.leave(roomId, userId);
    });

    // 错误处理
    socket.on('error', (err: Error) => {
      app.log.error({ err, roomId, userId }, 'WebSocket error');
    });
  });
}
