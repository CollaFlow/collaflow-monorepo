import { beforeEach, describe, expect, it, afterEach, vi } from 'vitest';

import { createEditor } from '../src/index';
import { setupMockWebSocket, teardownMockWebSocket } from './mock-websocket';

describe('@collaflow/collamarkdown/awareness', () => {
  let container: HTMLElement;

  beforeEach(() => {
    setupMockWebSocket();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    teardownMockWebSocket();
    container.remove();
  });

  it('getAwarenessUsers 应返回当前在线用户列表', async () => {
    const editor = await createEditor({
      root: container,
      defaultValue: '# Hello',
      collab: {
        roomId: 'room-1',
        userId: 'user-1',
        serverUrl: 'ws://localhost:3000',
        user: { name: 'Alice', color: '#ff6b6b' },
      },
    });

    // 等待 WebSocket 连接与 awareness 同步
    await new Promise((resolve) => setTimeout(resolve, 50));

    const users = editor.getAwarenessUsers();
    expect(users.length).toBeGreaterThan(0);
    expect(users.some((u) => u.user.name === 'Alice')).toBe(true);

    await editor.destroy();
  });

  it('onAwarenessChange 应在用户状态变化时被调用', async () => {
    const onAwarenessChange = vi.fn();

    const editor = await createEditor({
      root: container,
      defaultValue: '# Hello',
      collab: {
        roomId: 'room-1',
        userId: 'user-1',
        serverUrl: 'ws://localhost:3000',
        user: { name: 'Alice', color: '#ff6b6b' },
      },
      onAwarenessChange,
    });

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(onAwarenessChange).toHaveBeenCalled();
    expect(onAwarenessChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          user: expect.objectContaining({ name: 'Alice' }),
        }),
      ])
    );

    await editor.destroy();
  });

  it('两个编辑器应能相互感知对方用户', async () => {
    const container1 = document.createElement('div');
    const container2 = document.createElement('div');
    document.body.appendChild(container1);
    document.body.appendChild(container2);

    const editor1 = await createEditor({
      root: container1,
      defaultValue: '# Doc',
      collab: {
        roomId: 'room-1',
        userId: 'user-1',
        serverUrl: 'ws://localhost:3000',
        user: { name: 'Alice', color: '#ff6b6b' },
      },
    });

    const editor2 = await createEditor({
      root: container2,
      defaultValue: '# Doc',
      collab: {
        roomId: 'room-1',
        userId: 'user-2',
        serverUrl: 'ws://localhost:3000',
        user: { name: 'Bob', color: '#4dabf7' },
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 300));

    const users1 = editor1.getAwarenessUsers();
    const users2 = editor2.getAwarenessUsers();

    expect(users1.some((u) => u.user.name === 'Bob')).toBe(true);
    expect(users2.some((u) => u.user.name === 'Alice')).toBe(true);

    await editor1.destroy();
    await editor2.destroy();
    container1.remove();
    container2.remove();
  });
});
