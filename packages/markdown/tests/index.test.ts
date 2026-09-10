import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { MilkdownPlugin } from '@milkdown/ctx';

import { createEditor } from '../src/index';
import { resolveEditorOptions, DEFAULT_EDITOR_OPTIONS } from '../src/editor';

/**
 * listener 插件内部使用 200ms debounce，
 * 测试中需要预留足够时间等待回调触发。
 */
const LISTENER_DEBOUNCE_MS = 250;

describe('@collaflow/markdown', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('应能创建编辑器并渲染默认 Markdown 内容', async () => {
    const editor = await createEditor({
      root: container,
      defaultValue: '# Hello CollaFlow',
    });

    expect(editor.editor).toBeDefined();
    expect(editor.getMarkdown()).toContain('Hello CollaFlow');

    await editor.destroy();
  });

  it('setMarkdown 应更新编辑器内容', async () => {
    const editor = await createEditor({
      root: container,
      defaultValue: '# Initial',
    });

    await editor.setMarkdown('# Updated');

    expect(editor.getMarkdown()).toContain('Updated');
    expect(editor.getMarkdown()).not.toContain('Initial');

    await editor.destroy();
  });

  it('onChange 应在内容变化后被调用', async () => {
    const onChange = vi.fn();

    const editor = await createEditor({
      root: container,
      defaultValue: '# Initial',
      onChange,
    });

    await new Promise((resolve) => setTimeout(resolve, LISTENER_DEBOUNCE_MS));

    await editor.setMarkdown('# Changed');
    await new Promise((resolve) => setTimeout(resolve, LISTENER_DEBOUNCE_MS));

    expect(onChange).toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith(expect.stringContaining('Changed'));

    await editor.destroy();
  });

  it('未启用高亮时不应抛出异常', async () => {
    const editor = await createEditor({
      root: container,
      defaultValue: '# No Highlight',
      highlight: false,
    });

    expect(editor.getMarkdown()).toContain('No Highlight');

    await editor.destroy();
  });

  it('支持以对象形式配置高亮', async () => {
    const editor = await createEditor({
      root: container,
      defaultValue: '# Highlight',
      highlight: { type: 'prism' },
    });

    expect(editor.getMarkdown()).toContain('Highlight');

    await editor.destroy();
  });

  it('未启用协同时 getAwarenessUsers 应返回空数组', async () => {
    const editor = await createEditor({
      root: container,
      defaultValue: '# Solo',
    });

    expect(editor.getAwarenessUsers()).toEqual([]);

    await editor.destroy();
  });

  it('应注入浅色主题类名与 design 的 CSS 变量', async () => {
    const editor = await createEditor({
      root: container,
      defaultValue: '# Light',
      theme: 'light',
    });

    const root = container.querySelector('.milkdown') as HTMLElement;

    expect(root.classList.contains('colla-md')).toBe(true);
    expect(root.classList.contains('colla-md--light')).toBe(true);
    expect(root.dataset.theme).toBe('light');
    expect(root.style.cssText).toContain('--cf-bg-primary');
    expect(root.style.cssText).toContain('--cf-accent-blue');

    await editor.destroy();
  });

  it('resolveEditorOptions 应补齐默认值', () => {
    const resolved = resolveEditorOptions({ root: container });

    expect(resolved.defaultValue).toBe(DEFAULT_EDITOR_OPTIONS.defaultValue);
    expect(resolved.highlight).toBe(DEFAULT_EDITOR_OPTIONS.highlight);
    expect(resolved.theme).toBe(DEFAULT_EDITOR_OPTIONS.theme);
    expect(resolved.collab).toBeUndefined();
    expect(resolved.plugins).toBeUndefined();
    expect(resolved.onChange).toBeUndefined();
    expect(resolved.onAwarenessChange).toBeUndefined();
  });

  it('resolveEditorOptions 应保留调用方传入的配置', () => {
    const onChange = vi.fn();
    const onAwarenessChange = vi.fn();
    const plugins: MilkdownPlugin[] = [];

    const resolved = resolveEditorOptions({
      root: container,
      defaultValue: '# Custom',
      highlight: false,
      theme: 'dark',
      collab: { roomId: 'room', serverUrl: 'ws://localhost' },
      plugins,
      onChange,
      onAwarenessChange,
    });

    expect(resolved.defaultValue).toBe('# Custom');
    expect(resolved.highlight).toBe(false);
    expect(resolved.theme).toBe('dark');
    expect(resolved.collab?.roomId).toBe('room');
    expect(resolved.plugins).toBe(plugins);
    expect(resolved.onChange).toBe(onChange);
    expect(resolved.onAwarenessChange).toBe(onAwarenessChange);
  });
});
