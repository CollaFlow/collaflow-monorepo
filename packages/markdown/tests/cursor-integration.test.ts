import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import * as awarenessProtocol from 'y-protocols/awareness';
import type { Node as PMNode } from 'prosemirror-model';

import { createEditor, buildDomTextCounts } from '../src/index';
import { CollaFlowProvider, encodeRelativePosition, decodeSelection } from '../src/collab';
import { latestFakeProvider, resetFakeProviders } from './mock-provider';

vi.mock('@hocuspocus/provider', async () => ({
  HocuspocusProvider: (await import('./mock-provider')).FakeHocuspocusProvider,
}));

const COLLAB = { roomId: 'room-x', serverUrl: 'ws://localhost:1234' };

function joinRemoteWithSelection(
  name: string,
  color: string,
  anchor: number,
  head: number,
  content: Y.Text,
): void {
  const remoteDoc = new Y.Doc();
  const remoteAwareness = new awarenessProtocol.Awareness(remoteDoc);
  remoteAwareness.setLocalStateField('user', { name, color });
  remoteAwareness.setLocalStateField('selection', {
    anchor: encodeRelativePosition(content, anchor),
    head: encodeRelativePosition(content, head),
  });
  awarenessProtocol.applyAwarenessUpdate(
    latestFakeProvider().configuration.awareness,
    awarenessProtocol.encodeAwarenessUpdate(remoteAwareness, [remoteDoc.clientID]),
    null,
  );
}

describe('@collaflow/markdown/remote-cursor', () => {
  let container: HTMLElement;
  let schemaEditor: Awaited<ReturnType<typeof createEditor>>;

  beforeAll(async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    schemaEditor = await createEditor({ root: host, defaultValue: 'schema' });
  });

  afterAll(async () => {
    const dom = schemaEditor.getView().dom;
    await schemaEditor.destroy();
    dom.parentElement?.remove();
  });

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    resetFakeProviders();
  });

  afterEach(() => {
    container.remove();
  });

  it('setLocalSelection 应把选区编码进 awareness', () => {
    const provider = new CollaFlowProvider(COLLAB);
    provider.content.insert(0, 'hello world');

    provider.setLocalSelection(2, 5);

    const selection = provider.awareness.getLocalState()?.selection;
    expect(selection).toBeDefined();
    expect(decodeSelection(provider.content, selection)).toEqual({ anchor: 2, head: 5 });

    provider.destroy();
  });

  it('getRemoteCursors 应把远端选区解码为绝对偏移', () => {
    const provider = new CollaFlowProvider(COLLAB);
    provider.content.insert(0, 'hello world');

    joinRemoteWithSelection('Bob', '#ff0000', 3, 7, provider.content);

    const cursors = provider.getRemoteCursors();
    expect(cursors).toHaveLength(1);
    const c = cursors[0]!;
    expect(c.clientId).not.toBe(provider.doc.clientID);
    expect(c.anchor).toBe(3);
    expect(c.head).toBe(7);
    expect(c.user.name).toBe('Bob');

    provider.destroy();
  });

  it('getRemoteCursors 应跳过无 selection 或无用户的远端状态', () => {
    const provider = new CollaFlowProvider(COLLAB);
    provider.content.insert(0, 'hello world');

    const remoteDoc = new Y.Doc();
    const remoteAwareness = new awarenessProtocol.Awareness(remoteDoc);
    remoteAwareness.setLocalStateField('user', { name: 'X', color: '#00ff00' });
    awarenessProtocol.applyAwarenessUpdate(
      latestFakeProvider().configuration.awareness,
      awarenessProtocol.encodeAwarenessUpdate(remoteAwareness, [remoteDoc.clientID]),
      null,
    );

    expect(provider.getRemoteCursors()).toHaveLength(0);
    provider.destroy();
  });

  it('getRemoteCursors 应跳过 selection 解码失败的远端状态', () => {
    const provider = new CollaFlowProvider(COLLAB);
    provider.content.insert(0, 'hello world');

    const remoteDoc = new Y.Doc();
    const remoteAwareness = new awarenessProtocol.Awareness(remoteDoc);
    remoteAwareness.setLocalStateField('user', { name: 'Z', color: '#0000ff' });
    remoteAwareness.setLocalStateField('selection', { anchor: '###', head: '###' });
    awarenessProtocol.applyAwarenessUpdate(
      latestFakeProvider().configuration.awareness,
      awarenessProtocol.encodeAwarenessUpdate(remoteAwareness, [remoteDoc.clientID]),
      null,
    );

    expect(provider.getRemoteCursors()).toHaveLength(0);
    provider.destroy();
  });

  it('无 collab 时 setLocalSelection / getRemoteCursors 应安全降级', async () => {
    const editor = await createEditor({ root: container, defaultValue: 'hi' });
    expect(() => editor.setLocalSelection(0, 1)).not.toThrow();
    expect(editor.getRemoteCursors()).toEqual([]);
    await editor.destroy();
  });

  it('factory.setLocalSelection / getRemoteCursors 应委托给 provider', async () => {
    const editor = await createEditor({
      root: container,
      collab: { roomId: 'room-f', serverUrl: 'ws://localhost:1234' },
      defaultValue: 'hello world',
    });

    editor.setLocalSelection(1, 4);
    expect(editor.getRemoteCursors()).toEqual([]);
    expect(editor.getView()).toBeDefined();
    expect(editor.content.toString()).toBe('hello world');

    await editor.destroy();
  });

  it('buildDomTextCounts 应覆盖各类节点的真实文本统计', () => {
    const schema = schemaEditor.getView().state.schema;
    const strong = schema.marks.strong!.create();
    const em = schema.marks.emphasis!.create();
    const code = schema.marks.inlineCode!.create();

    const doc = schema.node('doc', null, [
      schema.node('heading', { level: 2 }, [schema.text('Title', [strong])]),
      schema.node('paragraph', null, [
        schema.text('Hello ', [em]),
        schema.text('world', [code]),
      ]),
      schema.node('blockquote', null, [
        schema.node('paragraph', null, [schema.text('quote')]),
      ]),
      schema.node('code_block', { language: 'js' }, [schema.text('const a = 1;')]),
      schema.node('code_block', {}, [schema.text('no lang')]),
      schema.node('bullet_list', null, [
        schema.node('list_item', null, [schema.node('paragraph', null, [schema.text('i1')])]),
        schema.node('list_item', null, [schema.node('paragraph', null, [schema.text('i2')])]),
      ]),
      schema.node('ordered_list', { order: 1, start: 1 }, [
        schema.node('list_item', null, [schema.node('paragraph', null, [schema.text('one')])]),
        schema.node('list_item', null, [schema.node('paragraph', null, [schema.text('two')])]),
      ]),
      schema.node('paragraph', null, [schema.node('hardbreak'), schema.text('after')]),
    ]);

    const markdown = ' '.repeat(400);
    const counts = buildDomTextCounts(doc, markdown);
    expect(counts.length).toBe(markdown.length + 1);
    expect(counts[0]).toBe(0);
    expect(counts[counts.length - 1]).toBeGreaterThan(0);
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1] ?? 0);
    }
  });

  it('buildDomTextCounts 应处理未知节点（按纯文本近似）', () => {
    const schema = schemaEditor.getView().state.schema;
    const realParagraph = schema.node('paragraph', null, [schema.text('plain')]);
    const fakeNode = {
      type: { name: 'image' },
      attrs: {},
      forEach: () => {},
      textContent: 'alt',
    } as unknown as PMNode;
    const fakeDoc = {
      type: { name: 'doc' },
      attrs: {},
      forEach: (fn: (n: PMNode) => void) => {
        fn(realParagraph);
        fn(fakeNode);
      },
      textContent: '',
    } as unknown as PMNode;

    const markdown = ' '.repeat(50);
    const counts = buildDomTextCounts(fakeDoc, markdown);
    expect(counts.length).toBe(markdown.length + 1);
    expect(counts[0]).toBe(0);
  });

  it('buildDomTextCounts 应安全处理无语言的 code_block', () => {
    const fakeCode = {
      type: { name: 'code_block' },
      attrs: { language: null },
      textContent: 'abc',
      forEach: () => {},
    } as unknown as PMNode;
    const fakeDoc = {
      type: { name: 'doc' },
      attrs: {},
      forEach: (fn: (n: PMNode) => void) => {
        fn(fakeCode);
      },
      textContent: '',
    } as unknown as PMNode;

    const markdown = ' '.repeat(30);
    const counts = buildDomTextCounts(fakeDoc, markdown);
    expect(counts.length).toBe(markdown.length + 1);
    expect(counts[counts.length - 1]).toBeGreaterThan(0);
  });
});
