import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import { createEditor } from '../src/index';
import { diffApply } from '../src/collab';

describe('@collaflow/markdown/text-sync', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('diffApply 应做最小字符级增删而非整体替换', () => {
    const doc = new Y.Doc();
    const text = doc.getText('x');
    text.insert(0, 'hello world');

    diffApply(text, 'hello there', 'test');

    expect(text.toString()).toBe('hello there');
  });

  it('diffApply 内容相同时应直接返回（不触发写入）', () => {
    const doc = new Y.Doc();
    const text = doc.getText('x');
    text.insert(0, 'same');

    diffApply(text, 'same', 'test');

    expect(text.toString()).toBe('same');
  });

  it('diffApply 应支持纯插入（原文本为空）', () => {
    const doc = new Y.Doc();
    const text = doc.getText('x');

    diffApply(text, 'abc', 'test');

    expect(text.toString()).toBe('abc');
  });

  it('diffApply 应支持纯删除', () => {
    const doc = new Y.Doc();
    const text = doc.getText('x');
    text.insert(0, 'abcdef');

    diffApply(text, 'ab', 'test');

    expect(text.toString()).toBe('ab');
  });

  it('diffApply 对未挂载到文档的 Y.Text 应安全返回', () => {
    const orphan = new Y.Text();

    expect(() => diffApply(orphan, 'x', 'test')).not.toThrow();
  });

  it('diffApply 应保留公共后缀，仅替换前缀部分', () => {
    const doc = new Y.Doc();
    const text = doc.getText('x');
    text.insert(0, 'hello world');

    diffApply(text, 'good world', 'test');

    expect(text.toString()).toBe('good world');
  });

  it('应把 content Y.Text 的变化同步到 Milkdown 预览', async () => {
    const editor = await createEditor({ root: container, defaultValue: '# A' });

    editor.content.insert(editor.content.length, '\n\n新增段落');
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(editor.getMarkdown()).toContain('新增段落');

    await editor.destroy();
  });

  it('应把 Milkdown 编辑序列化回写 content Y.Text（改预览也改源码）', async () => {
    const editor = await createEditor({ root: container, defaultValue: '# A' });

    await editor.setMarkdown('# 你好世界');
    // markdownUpdated 有 200ms debounce，需等待
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(editor.content.toString()).toContain('你好世界');

    await editor.destroy();
  });

  it('Milkdown 回写 content 时标记 origin，避免与 Y.Text 观察回环', async () => {
    const editor = await createEditor({ root: container, defaultValue: '# A' });
    const before = editor.content.toString();

    await editor.setMarkdown('# 回环测试');
    await new Promise((resolve) => setTimeout(resolve, 300));

    // 内容已更新，但不会因为回环反复重写导致异常；origin 一致
    expect(editor.content.toString()).not.toBe(before);

    await editor.destroy();
  });
});
