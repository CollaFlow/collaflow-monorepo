import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { schemaCtx } from '@milkdown/core';

import { createEditor } from '../src/index';

describe('@collaflow/collamarkdown/plugins', () => {
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

    const markdown = editor.getMarkdown();
    expect(markdown).toContain('```js');

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

    expect(container.classList.contains('colla-md--dark')).toBe(true);
    expect(container.style.cssText).toContain('--colla-md-bg');

    await editor.destroy();
  });
});
