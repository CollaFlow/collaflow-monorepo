import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import * as awarenessProtocol from 'y-protocols/awareness';

import { createEditor } from '../src/index';
import { CollaFlowProvider } from '../src/collab/provider';
import { latestFakeProvider, resetFakeProviders } from './mock-provider';

vi.mock('@hocuspocus/provider', async () => ({
  HocuspocusProvider: (await import('./mock-provider')).FakeHocuspocusProvider,
}));

const COLLAB = { roomId: 'room-1', serverUrl: 'ws://localhost:1234' };

describe('@collaflow/markdown/collab', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    resetFakeProviders();
  });

  afterEach(() => {
    container.remove();
  });

  it('应把 roomId 与 serverUrl 透传给 Hocuspocus', () => {
    const provider = new CollaFlowProvider(COLLAB);

    expect(latestFakeProvider().configuration.name).toBe('room-1');
    expect(latestFakeProvider().configuration.url).toBe('ws://localhost:1234');

    provider.destroy();
  });

  it('应把本地用户写入 awareness 并可被读取', () => {
    const provider = new CollaFlowProvider({
      ...COLLAB,
      user: { name: 'Alice', color: '#ff0000' },
    });

    const users = provider.getAwarenessUsers();
    expect(users).toHaveLength(1);
    expect(users[0]?.user.name).toBe('Alice');
    expect(users[0]?.clientId).toBe(provider.doc.clientID);

    provider.destroy();
  });

  it('未设置用户时 awareness 列表应为空', () => {
    const provider = new CollaFlowProvider(COLLAB);

    expect(provider.getAwarenessUsers()).toEqual([]);

    provider.destroy();
  });

  it('isConnected 应跟随 Hocuspocus 的状态回调', () => {
    const provider = new CollaFlowProvider(COLLAB);
    const fake = latestFakeProvider();

    expect(provider.isConnected).toBe(false);

    fake.emitStatus('connecting');
    expect(provider.isConnected).toBe(false);

    fake.emitStatus('connected');
    expect(provider.isConnected).toBe(true);

    fake.emitStatus('disconnected');
    expect(provider.isConnected).toBe(false);

    provider.destroy();
  });

  it('connect / disconnect / destroy 应透传到 Hocuspocus', () => {
    const provider = new CollaFlowProvider(COLLAB);
    const fake = latestFakeProvider();

    provider.connect();
    expect(fake.connectCalls).toBe(1);

    provider.disconnect();
    expect(fake.disconnectCalls).toBe(1);

    provider.destroy();
    expect(fake.destroyCalls).toBe(1);
  });

  it('两个 Provider 的文档可通过 Yjs update 互相同步', () => {
    const a = new CollaFlowProvider({ ...COLLAB, roomId: 'room-1' });
    const b = new CollaFlowProvider({ ...COLLAB, roomId: 'room-1' });

    a.doc.getText('shared').insert(0, 'hello');

    Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc));

    expect(b.doc.getText('shared').toString()).toBe('hello');

    a.destroy();
    b.destroy();
  });

  it('远端 awareness 更新应合并进本地用户列表', () => {
    const provider = new CollaFlowProvider({
      ...COLLAB,
      user: { name: 'Alice', color: '#ff0000' },
    });

    const remoteDoc = new Y.Doc();
    const remoteAwareness = new awarenessProtocol.Awareness(remoteDoc);
    remoteAwareness.setLocalStateField('user', { name: 'Bob', color: '#00ff00' });

    awarenessProtocol.applyAwarenessUpdate(
      provider.awareness,
      awarenessProtocol.encodeAwarenessUpdate(remoteAwareness, [remoteDoc.clientID]),
      null
    );

    const names = provider.getAwarenessUsers().map((state) => state.user.name).sort();
    expect(names).toEqual(['Alice', 'Bob']);

    provider.destroy();
  });

  it('应过滤掉没有用户信息的 awareness 状态', () => {
    const provider = new CollaFlowProvider(COLLAB);

    const anonymousDoc = new Y.Doc();
    const anonymousAwareness = new awarenessProtocol.Awareness(anonymousDoc);
    anonymousAwareness.setLocalState({});

    awarenessProtocol.applyAwarenessUpdate(
      provider.awareness,
      awarenessProtocol.encodeAwarenessUpdate(anonymousAwareness, [anonymousDoc.clientID]),
      null
    );

    expect(provider.getAwarenessUsers()).toEqual([]);

    provider.destroy();
  });

  it('createEditor 启用协同时应创建 Provider 并连接', async () => {
    const editor = await createEditor({
      root: container,
      defaultValue: '# Collab',
      collab: { ...COLLAB, user: { name: 'Alice', color: '#ff0000' } },
    });

    const fake = latestFakeProvider();
    expect(fake.configuration.name).toBe('room-1');
    expect(fake.connectCalls).toBeGreaterThanOrEqual(1);
    expect(editor.getAwarenessUsers()).toHaveLength(1);

    await editor.destroy();

    expect(fake.destroyCalls).toBe(1);
  });

  it('onAwarenessChange 应在初始化时触发一次', async () => {
    const onAwarenessChange = vi.fn();

    const editor = await createEditor({
      root: container,
      defaultValue: '# Collab',
      collab: { ...COLLAB, user: { name: 'Alice', color: '#ff0000' } },
      onAwarenessChange,
    });

    expect(onAwarenessChange).toHaveBeenCalledTimes(1);

    await editor.destroy();

    expect(onAwarenessChange).toHaveBeenCalledTimes(1);
  });
});
