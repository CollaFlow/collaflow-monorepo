import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createEditor } from '../src/index';

describe('@collaflow/markdown/gfm', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('应解析并保留 GFM 表格', async () => {
    const markdown = `| Name | Age |
| --- | --- |
| Alice | 24 |
| Bob | 30 |`;

    const editor = await createEditor({
      root: container,
      defaultValue: markdown,
    });

    const result = editor.getMarkdown();
    expect(result).toContain('| Name');
    expect(result).toContain('| Age |');
    expect(result).toContain('| Alice');
    expect(result).toMatch(/\|\s*24\s*\|/);

    const table = container.querySelector('table');
    expect(table).not.toBeNull();
    expect(table?.querySelector('tr[data-is-header="true"]')).not.toBeNull();
    expect(table?.querySelectorAll('th').length).toBe(2);
    expect(table?.querySelectorAll('td').length).toBe(4);

    await editor.destroy();
  });

  it('应解析并保留 GFM 任务列表', async () => {
    const markdown = `- [x] Done
- [ ] Todo`;

    const editor = await createEditor({
      root: container,
      defaultValue: markdown,
    });

    const result = editor.getMarkdown();
    expect(result).toContain('[x] Done');
    expect(result).toContain('[ ] Todo');

    const items = container.querySelectorAll('li[data-item-type="task"]');
    expect(items.length).toBe(2);
    expect(items[0]?.getAttribute('data-checked')).toBe('true');
    expect(items[1]?.getAttribute('data-checked')).toBe('false');

    await editor.destroy();
  });

  it('点击任务列表复选框区域应切换 checked 状态', async () => {
    const markdown = '- [ ] Todo';

    const editor = await createEditor({
      root: container,
      defaultValue: markdown,
    });

    const li = container.querySelector('li[data-item-type="task"]') as HTMLElement;
    expect(li).not.toBeNull();
    expect(li.getAttribute('data-checked')).toBe('false');

    const rect = li.getBoundingClientRect();
    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      clientX: rect.left + 4,
      clientY: rect.top + rect.height / 2,
    });
    li.dispatchEvent(clickEvent);

    const updatedLi = container.querySelector('li[data-item-type="task"]') as HTMLElement;
    expect(updatedLi.getAttribute('data-checked')).toBe('true');
    expect(editor.getMarkdown()).toContain('[x] Todo');

    await editor.destroy();
  });

  it('点击任务列表正文区域不应切换状态', async () => {
    const markdown = '- [ ] Todo';

    const editor = await createEditor({
      root: container,
      defaultValue: markdown,
    });

    const li = container.querySelector('li[data-item-type="task"]') as HTMLElement;
    const rect = li.getBoundingClientRect();
    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      clientX: rect.left + 60,
      clientY: rect.top + rect.height / 2,
    });
    li.dispatchEvent(clickEvent);

    expect(li.getAttribute('data-checked')).toBe('false');

    await editor.destroy();
  });

  it('应解析并保留 GFM 脚注', async () => {
    const markdown = `Reference[^1].

[^1]: Footnote content.`;

    const editor = await createEditor({
      root: container,
      defaultValue: markdown,
    });

    const result = editor.getMarkdown();
    expect(result).toContain('[^1]');
    expect(result).toContain('Footnote content.');

    const ref = container.querySelector('sup[data-type="footnote_reference"]');
    expect(ref).not.toBeNull();
    expect(ref?.getAttribute('data-label')).toBe('1');

    const def = container.querySelector('dl[data-type="footnote_definition"]');
    expect(def).not.toBeNull();

    await editor.destroy();
  });

  it('应解析并保留删除线', async () => {
    const markdown = '~~deleted~~';

    const editor = await createEditor({
      root: container,
      defaultValue: markdown,
    });

    expect(editor.getMarkdown()).toContain('~~deleted~~');

    const del = container.querySelector('del');
    expect(del).not.toBeNull();
    expect(del?.textContent).toBe('deleted');

    await editor.destroy();
  });

  it('应自动识别裸链接为可点击链接', async () => {
    const markdown = 'Visit https://example.com for details.';

    const editor = await createEditor({
      root: container,
      defaultValue: markdown,
    });

    const link = container.querySelector('a[href="https://example.com"]');
    expect(link).not.toBeNull();
    expect(link?.textContent).toBe('https://example.com');

    await editor.destroy();
  });

  it('点击非 ProseMirror 管理的任务列表项不应崩溃', async () => {
    const editor = await createEditor({
      root: container,
      defaultValue: '# Hello',
    });

    const root = container.querySelector('.milkdown') as HTMLElement;
    const fakeLi = document.createElement('li');
    fakeLi.setAttribute('data-item-type', 'task');
    fakeLi.setAttribute('data-checked', 'false');
    fakeLi.textContent = 'Fake';
    root.appendChild(fakeLi);

    const rect = fakeLi.getBoundingClientRect();
    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      clientX: rect.left + 4,
      clientY: rect.top + rect.height / 2,
    });
    fakeLi.dispatchEvent(clickEvent);

    // 未抛出异常即通过
    expect(fakeLi.getAttribute('data-checked')).toBe('false');

    fakeLi.remove();
    await editor.destroy();
  });

  it('应注入 GFM 相关 Notion 风格样式', async () => {
    await createEditor({ root: container, defaultValue: '# Hello' });

    const style = document.getElementById('colla-md-notion-style');
    expect(style?.textContent).toContain('li[data-item-type="task"]');
    expect(style?.textContent).toContain('dl[data-type="footnote_definition"]');
    expect(style?.textContent).toContain('tr[data-is-header="true"]');

    // 样式应使用 design tokens，而非硬编码色值
    expect(style?.textContent).toContain('var(--cf-bg-tertiary)');
    expect(style?.textContent).toContain('var(--cf-accent-blue)');
    expect(style?.textContent).toContain('var(--cf-border-default)');
  });
});
