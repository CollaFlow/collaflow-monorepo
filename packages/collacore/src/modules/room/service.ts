import type { MessageBus } from '../../infrastructure/message-bus';

export interface RoomConnection {
  userId: string;
  send: (data: Uint8Array) => void;
}

export interface Room {
  id: string;
  connections: Map<string, RoomConnection>;
}

/**
 * 房间服务。
 *
 * 职责：
 * - 管理房间生命周期（创建、销毁）
 * - 维护房间内连接
 * - 同进程内直接广播，跨进程通过 MessageBus 广播
 */
export class RoomService {
  private rooms = new Map<string, Room>();
  private messageBus: MessageBus;

  constructor(messageBus: MessageBus) {
    this.messageBus = messageBus;
  }

  private getChannel(roomId: string): string {
    return `collaflow:room:${roomId}`;
  }

  /**
   * 用户加入房间。
   */
  async join(roomId: string, connection: RoomConnection): Promise<void> {
    let room = this.rooms.get(roomId);

    if (!room) {
      room = { id: roomId, connections: new Map() };
      this.rooms.set(roomId, room);

      // 订阅跨进程广播
      await this.messageBus.subscribe(this.getChannel(roomId), (message) => {
        this.localBroadcast(roomId, null, message);
      });
    }

    room.connections.set(connection.userId, connection);
  }

  /**
   * 用户离开房间。
   */
  async leave(roomId: string, userId: string): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.connections.delete(userId);

    // 最后一人离开时销毁房间
    if (room.connections.size === 0) {
      this.rooms.delete(roomId);
      await this.messageBus.unsubscribe(this.getChannel(roomId));
    }
  }

  /**
   * 向房间内其他用户广播消息。
   */
  async broadcast(roomId: string, senderId: string | null, message: Uint8Array): Promise<void> {
    // 1. 同进程广播
    this.localBroadcast(roomId, senderId, message);

    // 2. 跨进程广播
    await this.messageBus.publish(this.getChannel(roomId), message);
  }

  /**
   * 仅向当前进程内的房间用户广播。
   */
  private localBroadcast(roomId: string, senderId: string | null, message: Uint8Array): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.connections.forEach((connection, userId) => {
      if (userId === senderId) return;
      try {
        connection.send(message);
      } catch (err) {
        // 发送失败时忽略，连接关闭时会自动清理
        console.error(`Failed to send message to ${userId}:`, err);
      }
    });
  }

  /**
   * 获取房间信息（用于调试或管理接口）。
   */
  getRoom(roomId: string): { id: string; userCount: number; users: string[] } | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    return {
      id: room.id,
      userCount: room.connections.size,
      users: Array.from(room.connections.keys()),
    };
  }
}
