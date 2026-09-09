/**
 * 房间 WebSocket 消息协议。
 *
 * 二进制格式：
 * [1 byte message type][N bytes payload]
 *
 * 当前支持的消息类型：
 * - 0x00: Yjs document update
 * - 0x01: Yjs awareness update
 *
 * 服务器不需要解析 payload 内容，仅根据类型转发。
 */

export enum RoomMessageType {
  Update = 0x00,
  Awareness = 0x01,
}

export interface ParsedRoomMessage {
  type: RoomMessageType;
  payload: Uint8Array;
}

/**
 * 解析 WebSocket 收到的二进制消息。
 */
export function parseRoomMessage(data: Uint8Array): ParsedRoomMessage {
  if (data.length === 0) {
    throw new Error('Empty room message');
  }

  const type = data[0] as RoomMessageType;
  const payload = data.slice(1);

  return { type, payload };
}

/**
 * 构造 WebSocket 二进制消息。
 */
export function buildRoomMessage(type: RoomMessageType, payload: Uint8Array): Uint8Array {
  const message = new Uint8Array(1 + payload.length);
  message[0] = type;
  message.set(payload, 1);
  return message;
}

/**
 * 获取消息类型的可读名称。
 */
export function getRoomMessageTypeName(type: RoomMessageType): string {
  switch (type) {
    case RoomMessageType.Update:
      return 'update';
    case RoomMessageType.Awareness:
      return 'awareness';
    default:
      return `unknown(${type})`;
  }
}
