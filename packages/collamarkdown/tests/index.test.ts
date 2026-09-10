import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createEditor } from '../src/index';

/**
 * listener 插件内部使用 200ms debounce，
 * 测试中需要预留足够时间等待回调触发。
 */
const LISTENER_DEBOUNCE_MS = 250;

describe('@collaflow/collamarkdown', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('应能创建编辑器并渲染默认 Markdown 内容', async () => {
    const defaultValue = '# Hello CollaMarkdown';

    const editor = await createEditor({
      root: container,
      defaultValue,
    });

    expect(editor.editor).toBeDefined();
    expect(editor.getMarkdown()).toContain('Hello CollaMarkdown');

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
});
