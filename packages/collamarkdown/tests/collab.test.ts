import { beforeEach, describe, expect, it, afterEach } from 'vitest';
import * as Y from 'yjs';

import { CollaCoreProvider, CollaCoreMessageType } from '../src/collab/provider';
import { setupMockWebSocket, teardownMockWebSocket, type MockWebSocketServer } from './mock-websocket';

describe('@collaflow/collamarkdown/collab', () => {
  let server: MockWebSocketServer;

  beforeEach(() => {
    server = setupMockWebSocket();
  });

  afterEach(() => {
    teardownMockWebSocket();
  });

  it('Provider 连接后应发送当前 Y.Doc 状态', async () => {
    const provider = new CollaCoreProvider({
      roomId: 'room-1',
      userId: 'user-1',
      serverUrl: 'ws://localhost:3000',
    });

    const receivedMessages: Uint8Array[] = [];

    // 拦截广播
    const originalBroadcast = server.broadcast.bind(server);
    server.broadcast = (sender, data) => {
      receivedMessages.push(data);
      return originalBroadcast(sender, data);
    };

    provider.connect();

    // 等待 WebSocket open 与消息发送
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(receivedMessages.length).toBeGreaterThan(0);
    expect(receivedMessages[0]?.[0]).toBe(CollaCoreMessageType.Update);

    provider.destroy();
  });

  it('Provider 应将收到的 Yjs update 应用到本地 Y.Doc', async () => {
    const provider1 = new CollaCoreProvider({
      roomId: 'room-1',
      userId: 'user-1',
      serverUrl: 'ws://localhost:3000',
    });

    const provider2 = new CollaCoreProvider({
      roomId: 'room-1',
      userId: 'user-2',
      serverUrl: 'ws://localhost:3000',
    });

    provider1.connect();
    provider2.connect();

    await new Promise((resolve) => setTimeout(resolve, 50));

    // 在 provider1 的 doc 中写入内容
    provider1.doc.getXmlFragment('prosemirror').insert(0, [new Y.XmlText('hello')]);

    await new Promise((resolve) => setTimeout(resolve, 50));

    // provider2 应同步到相同内容
    const text2 = provider2.doc.getXmlFragment('prosemirror').toString();
    expect(text2).toContain('hello');

    provider1.destroy();
    provider2.destroy();
  });

  it('Provider 应转发 Awareness 更新', async () => {
    const provider1 = new CollaCoreProvider({
      roomId: 'room-1',
      userId: 'user-1',
      serverUrl: 'ws://localhost:3000',
      user: { name: 'Alice', color: '#ff6b6b' },
    });

    const provider2 = new CollaCoreProvider({
      roomId: 'room-1',
      userId: 'user-2',
      serverUrl: 'ws://localhost:3000',
    });

    provider1.connect();
    provider2.connect();

    await new Promise((resolve) => setTimeout(resolve, 50));

    // provider1 设置 awareness 状态
    provider1.awareness.setLocalState({ user: { name: 'Alice', color: '#ff6b6b' } });

    await new Promise((resolve) => setTimeout(resolve, 50));

    // provider2 应感知到 provider1 的用户信息
    const states = Array.from(provider2.awareness.getStates().values());
    expect(states.some((state) => state?.user?.name === 'Alice')).toBe(true);

    provider1.destroy();
    provider2.destroy();
  });
});
