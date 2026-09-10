import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { schemaCtx } from '@milkdown/core';

import { createEditor } from '../src/index';
import { createHighlightPlugin, configureHighlightLanguages, refractor, prism } from '../src/editor/plugins/highlight';
import { collaCursorBuilder, collaSelectionBuilder } from '../src/editor/plugins/awareness';
import type { AwarenessUserInfo } from '../src/types';

type ToDOM = (node: { attrs: Record<string, unknown> }) => [string, Record<string, string>, number];
type ParseRule = { tag: string; getAttrs: (dom: HTMLElement) => Record<string, unknown> };
type NodeSpecLike = { toDOM?: unknown; parseDOM?: unknown };

/** 从 schema 中取出节点定义，未注册时直接失败。 */
function nodeSpec(nodes: Record<string, { spec: NodeSpecLike }>, name: string): NodeSpecLike {
  const nodeType = nodes[name];
  if (!nodeType) throw new Error(`node ${name} is not registered`);
  return nodeType.spec;
}

function parseRules(spec: NodeSpecLike): ParseRule[] {
  return (spec.parseDOM ?? []) as ParseRule[];
}

function toDOM(spec: NodeSpecLike): ToDOM {
  return spec.toDOM as ToDOM;
}

const alice: AwarenessUserInfo = { name: 'Alice', color: '#ff0000' };

describe('@collaflow/markdown/plugins', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('代码块应被正确解析并保留语言信息', async () => {
    const editor = await createEditor({
      root: container,
      defaultValue: '```js\nconst x = 1;\n```',
      highlight: true,
    });

    expect(editor.getMarkdown()).toContain('```js');

    await editor.destroy();
  });

  it('布局节点应注册到编辑器 schema 中', async () => {
    const editor = await createEditor({
      root: container,
      defaultValue: '# Hello',
    });

    const schema = editor.editor.ctx.get(schemaCtx);
    expect(schema.nodes.callout).toBeDefined();
    expect(schema.nodes.columns).toBeDefined();
    expect(schema.nodes.column).toBeDefined();
    expect(schema.nodes.card).toBeDefined();

    await editor.destroy();
  });

  it('暗色主题应为根节点注入暗色 CSS 变量', async () => {
    const editor = await createEditor({
      root: container,
      defaultValue: '# Hello',
      theme: 'dark',
    });

    const root = container.querySelector('.milkdown') as HTMLElement;

    expect(root.classList.contains('colla-md--dark')).toBe(true);
    expect(root.dataset.theme).toBe('dark');
    expect(root.style.cssText).toContain('--cf-bg-primary');
    expect(root.style.cssText).toContain('--colla-md-selection');

    await editor.destroy();
  });

  it('布局节点应能序列化为 DOM 并从 DOM 还原', async () => {
    const editor = await createEditor({ root: container, defaultValue: '# Hello' });
    const schema = editor.editor.ctx.get(schemaCtx);

    const nodes = schema.nodes as unknown as Record<string, { spec: NodeSpecLike }>;

    const calloutOut = toDOM(nodeSpec(nodes, 'callout'))({ attrs: { type: 'warning' } });
    expect(calloutOut[0]).toBe('div');
    expect(calloutOut[1].class).toBe('callout callout--warning');
    expect(calloutOut[1]['data-type']).toBe('warning');

    const columnsOut = toDOM(nodeSpec(nodes, 'columns'))({ attrs: { columns: 3 } });
    expect(columnsOut[1].class).toBe('columns');
    expect(columnsOut[1]['data-columns']).toBe(3);

    const columnOut = toDOM(nodeSpec(nodes, 'column'))({ attrs: {} });
    expect(columnOut[1].class).toBe('column');

    const cardOut = toDOM(nodeSpec(nodes, 'card'))({ attrs: { title: 'Note' } });
    expect(cardOut[1].class).toBe('card');
    expect(cardOut[1]['data-title']).toBe('Note');

    const calloutDom = document.createElement('div');
    calloutDom.className = 'callout';
    calloutDom.dataset.type = 'danger';
    expect(parseRules(nodeSpec(nodes, 'callout'))[0]?.getAttrs(calloutDom)).toEqual({
      type: 'danger',
    });

    const calloutDomNoType = document.createElement('div');
    expect(parseRules(nodeSpec(nodes, 'callout'))[0]?.getAttrs(calloutDomNoType)).toEqual({
      type: 'info',
    });

    const columnsDom = document.createElement('div');
    columnsDom.dataset.columns = '4';
    expect(parseRules(nodeSpec(nodes, 'columns'))[0]?.getAttrs(columnsDom)).toEqual({ columns: 4 });

    const columnsDomDefault = document.createElement('div');
    expect(parseRules(nodeSpec(nodes, 'columns'))[0]?.getAttrs(columnsDomDefault)).toEqual({
      columns: 2,
    });

    const cardDom = document.createElement('div');
    cardDom.dataset.title = 'Title';
    expect(parseRules(nodeSpec(nodes, 'card'))[0]?.getAttrs(cardDom)).toEqual({ title: 'Title' });

    const cardDomDefault = document.createElement('div');
    expect(parseRules(nodeSpec(nodes, 'card'))[0]?.getAttrs(cardDomDefault)).toEqual({ title: '' });

    await editor.destroy();
  });

  it('高亮插件默认注册 prism 与 refractor 语言', () => {
    const result = createHighlightPlugin();

    expect(result.plugins).toBe(prism);
    expect(result.configure).toBeTypeOf('function');
    expect(refractor.registered('typescript')).toBe(true);
    expect(refractor.registered('bash')).toBe(true);
  });

  it('高亮插件支持显式指定 prism', () => {
    const result = createHighlightPlugin({ type: 'prism' });

    expect(result.plugins).toBe(prism);
    expect(result.configure).toBeTypeOf('function');
  });

  it('高亮插件在 shiki 模式下不注册语言', () => {
    const result = createHighlightPlugin({ type: 'shiki' });

    expect(result.plugins).toBe(prism);
    expect(result.configure).toBeUndefined();
  });

  it('configureHighlightLanguages 应可注册自定义语法集', () => {
    configureHighlightLanguages([]);

    expect(refractor.registered('markdown')).toBe(true);
  });

  it('协同光标与选区应按用户颜色渲染', () => {
    const cursor = collaCursorBuilder(alice, 1);

    expect(cursor.className).toBe('colla-cursor');
    expect(cursor.style.borderLeftColor).toBe('rgb(255, 0, 0)');
    expect(cursor.querySelector('.colla-cursor-label')?.textContent).toBe('Alice');

    const selection = collaSelectionBuilder(alice);
    expect(selection.class).toBe('colla-selection');
    expect(selection.style).toBe('background-color: #ff000033;');
  });

  it('应注入 Notion 风格样式表且仅注入一次', async () => {
    const editor = await createEditor({ root: container, defaultValue: '# Hello' });

    const style = document.getElementById('colla-md-notion-style');
    expect(style).not.toBeNull();
    expect(style?.textContent).toContain('.colla-md h1');

    const before = document.querySelectorAll('style#colla-md-notion-style').length;

    const second = document.createElement('div');
    document.body.appendChild(second);
    await createEditor({ root: second, defaultValue: 'second' });
    const after = document.querySelectorAll('style#colla-md-notion-style').length;
    expect(after).toBe(before);

    await editor.destroy();
    second.remove();
  });
});
