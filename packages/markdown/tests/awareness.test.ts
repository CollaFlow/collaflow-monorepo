import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import * as awarenessProtocol from 'y-protocols/awareness';

import { createEditor } from '../src/index';
import { createAwarenessPlugin } from '../src/editor/plugins/awareness';
import { latestFakeProvider, resetFakeProviders } from './mock-provider';

vi.mock('@hocuspocus/provider', async () => ({
  HocuspocusProvider: (await import('./mock-provider')).FakeHocuspocusProvider,
}));

const COLLAB = { roomId: 'room-1', serverUrl: 'ws://localhost:1234' };

/** 模拟一个远端用户加入房间。 */
function joinAsRemoteUser(name: string, color: string): void {
  const remoteDoc = new Y.Doc();
  const remoteAwareness = new awarenessProtocol.Awareness(remoteDoc);
  remoteAwareness.setLocalStateField('user', { name, color });

  awarenessProtocol.applyAwarenessUpdate(
    latestFakeProvider().configuration.awareness,
    awarenessProtocol.encodeAwarenessUpdate(remoteAwareness, [remoteDoc.clientID]),
    null
  );
}

describe('@collaflow/markdown/awareness', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    resetFakeProviders();
  });

  afterEach(() => {
    container.remove();
  });

  it('远端用户加入后应触发 onAwarenessChange', async () => {
    const onAwarenessChange = vi.fn();

    const editor = await createEditor({
      root: container,
      defaultValue: '# Collab',
      collab: { ...COLLAB, user: { name: 'Alice', color: '#ff0000' } },
      onAwarenessChange,
    });

    expect(onAwarenessChange).toHaveBeenCalledTimes(1);

    joinAsRemoteUser('Bob', '#00ff00');

    expect(onAwarenessChange).toHaveBeenCalledTimes(2);

    const latest = onAwarenessChange.mock.lastCall?.[0] as { user: { name: string } }[];
    expect(latest.map((state) => state.user.name).sort()).toEqual(['Alice', 'Bob']);

    await editor.destroy();
  });

  it('销毁后不应再收到 awareness 变化', async () => {
    const onAwarenessChange = vi.fn();

    const editor = await createEditor({
      root: container,
      defaultValue: '# Collab',
      collab: { ...COLLAB, user: { name: 'Alice', color: '#ff0000' } },
      onAwarenessChange,
    });

    await editor.destroy();

    onAwarenessChange.mockClear();

    const provider = latestFakeProvider();
    provider.configuration.awareness.setLocalStateField('user', {
      name: 'Alice',
      color: '#ff0000',
    });

    expect(onAwarenessChange).not.toHaveBeenCalled();
  });

  it('createAwarenessPlugin 应返回 y-prosemirror 光标插件', () => {
    const doc = new Y.Doc();
    const awareness = new awarenessProtocol.Awareness(doc);

    expect(createAwarenessPlugin(awareness)).toBeDefined();

    awareness.destroy();
    doc.destroy();
  });
});
