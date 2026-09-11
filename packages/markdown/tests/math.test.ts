import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createEditor } from '../src/index';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('@collaflow/markdown/math', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('应把块级 $$...$$ 渲染为 KaTeX 并显示源码仍是 $$', async () => {
    const markdown = `行内公式 $a^2 + b^2 = c^2$ 在此。

$$
E = mc^2
$$`;

    const editor = await createEditor({ root: container, defaultValue: markdown });
    await wait(10);

    const blockKatex = container.querySelector('[data-type="math_block"]');
    expect(blockKatex).not.toBeNull();
    // KaTeX 渲染出公式内容（非源码字符串）
    expect(blockKatex?.textContent).toContain('E');

    const inlineKatex = container.querySelector('[data-type="math_inline"]');
    expect(inlineKatex).not.toBeNull();

    // 源码保持 $$...$$ / $...$
    const out = editor.getMarkdown();
    expect(out).toContain('$a^2 + b^2 = c^2$');
    expect(out).toContain('$$');
    expect(out).toContain('E = mc^2');

    await editor.destroy();
  });

  it('编辑源码区的 $$...$$ 应回灌并重新渲染公式', async () => {
    const editor = await createEditor({ root: container, defaultValue: '# 标题' });
    await wait(5);

    await editor.setMarkdown('$$\n\\int_0^1 x^2 dx\n$$');
    await wait(10);

    const blockKatex = container.querySelector('[data-type="math_block"]');
    expect(blockKatex).not.toBeNull();
    expect(blockKatex?.textContent).toContain('∫');

    // 源码回写仍保留块级 $$...$$ 与反斜杠转义
    const out = editor.getMarkdown();
    expect(out).toContain('$$\n\\int_0^1 x^2 dx\n$$');

    await editor.destroy();
  });
});
