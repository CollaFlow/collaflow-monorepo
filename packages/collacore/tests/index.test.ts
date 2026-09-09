import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { encodeStateAsUpdate, applyUpdate } from 'yjs';

import { createServer } from '../src/server';
import { InMemoryMessageBus } from '../src/infrastructure/message-bus';
import { RoomService } from '../src/modules/room/service';
import { buildRoomMessage, RoomMessageType } from '../src/modules/room/protocol';

describe('@collaflow/collacore', () => {
  it('should create a Fastify server', async () => {
    const app = await createServer({ logger: false, messageBus: new InMemoryMessageBus() });
    expect(app).toBeDefined();
    expect(typeof app.listen).toBe('function');
    await app.close();
  });

  it('should return ok on /health', async () => {
    const app = await createServer({ logger: false, messageBus: new InMemoryMessageBus() });
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.payload);
    expect(payload.status).toBe('ok');
    expect(typeof payload.timestamp).toBe('number');
    await app.close();
  });

  it('should manage room lifecycle', async () => {
    const bus = new InMemoryMessageBus();
    const roomService = new RoomService(bus);

    const received: string[] = [];

    await roomService.join('room-1', {
      userId: 'user-a',
      send: (msg) => received.push(new TextDecoder().decode(msg)),
    });

    await roomService.join('room-1', {
      userId: 'user-b',
      send: () => {},
    });

    const room = roomService.getRoom('room-1');
    expect(room?.userCount).toBe(2);

    await roomService.broadcast('room-1', 'user-b', new TextEncoder().encode('hello'));
    expect(received).toEqual(['hello']);

    await roomService.leave('room-1', 'user-a');
    expect(roomService.getRoom('room-1')?.userCount).toBe(1);

    await roomService.leave('room-1', 'user-b');
    expect(roomService.getRoom('room-1')).toBeNull();

    await bus.close();
  });

  it('should sync Yjs documents across room instances', async () => {
    // 模拟两个独立的 collacore 实例，通过共享内存总线通信
    const busA = new InMemoryMessageBus('instance-a');
    const busB = busA.createPeer('instance-b');

    const roomServiceA = new RoomService(busA);
    const roomServiceB = new RoomService(busB);

    const docA = new Y.Doc();
    const docB = new Y.Doc();

    const receivedUpdatesB: Uint8Array[] = [];

    // user-a 在实例 A 加入房间
    await roomServiceA.join('room-yjs', {
      userId: 'user-a',
      send: () => {},
    });

    // user-b 在实例 B 加入房间
    await roomServiceB.join('room-yjs', {
      userId: 'user-b',
      send: (msg) => {
        // 模拟客户端收到 update 消息并应用
        if (msg[0] === RoomMessageType.Update) {
          receivedUpdatesB.push(msg.slice(1));
        }
      },
    });

    // user-a 修改文档
    const textA = docA.getText('content');
    textA.insert(0, 'Hello CollaFlow');

    // 发送 Yjs update
    const update = encodeStateAsUpdate(docA);
    const message = buildRoomMessage(RoomMessageType.Update, update);
    await roomServiceA.broadcast('room-yjs', 'user-a', message);

    // 验证 user-b 收到 update
    expect(receivedUpdatesB.length).toBe(1);

    // 应用 update 到 docB
    const updateB = receivedUpdatesB[0];
    expect(updateB).toBeDefined();
    applyUpdate(docB, updateB!);

    const textB = docB.getText('content');
    expect(textB.toString()).toBe('Hello CollaFlow');

    await roomServiceA.leave('room-yjs', 'user-a');
    await roomServiceB.leave('room-yjs', 'user-b');

    await busA.close();
    await busB.close();
  });
});
