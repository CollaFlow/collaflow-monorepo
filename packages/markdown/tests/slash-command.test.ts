import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TextSelection } from 'prosemirror-state';
import { Editor, defaultValueCtx, editorViewCtx, rootCtx } from '@milkdown/core';
import { commonmark } from '@milkdown/preset-commonmark';

import { createEditor } from '../src/index';
import { createSlashCommandPlugin, createDefaultSlashItems } from '../src/editor/plugins/slash-command';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('@collaflow/markdown/slash-command', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  function pressKey(view: ReturnType<typeof createEditor> extends Promise<infer T> ? T extends { getView(): infer V } ? V : never : never, key: string) {
    const event = new KeyboardEvent('keydown', { key, bubbles: true });
    view.dom.dispatchEvent(event);
  }

  it('输入 / 应弹出 Slash 菜单', async () => {
    const editor = await createEditor({ root: container, defaultValue: '/' });
    await wait(0);

    const view = editor.getView();
    const end = view.state.selection.$from.end();
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, end)));
    await wait(0);

    const menu = container.querySelector('.colla-slash-menu') as HTMLElement;
    expect(menu).not.toBeNull();
    expect(menu.style.display).not.toBe('none');

    const items = menu.querySelectorAll('.colla-slash-menu__item');
    expect(items.length).toBeGreaterThan(0);

    await editor.destroy();
  });

  it('输入 /heading 应过滤出标题命令', async () => {
    const editor = await createEditor({ root: container, defaultValue: '/heading' });
    await wait(0);

    const view = editor.getView();
    const end = view.state.selection.$from.end();
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, end)));
    await wait(0);

    const menu = container.querySelector('.colla-slash-menu') as HTMLElement;
    const items = Array.from(menu.querySelectorAll('.colla-slash-menu__item'));
    const labels = items.map((el) => el.textContent);
    expect(labels.every((l) => l?.includes('标题'))).toBe(true);

    await editor.destroy();
  });

  it('按 Enter 应执行当前选中命令', async () => {
    const editor = await createEditor({ root: container, defaultValue: '/' });
    await wait(0);

    const view = editor.getView();
    const end = view.state.selection.$from.end();
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, end)));
    await wait(0);

    pressKey(view, 'Enter');
    await wait(0);

    const md = editor.getMarkdown();
    // 默认第一项为 "标题 1"
    expect(md).toMatch(/^#/m);

    await editor.destroy();
  });

  it('按 Escape 应关闭 Slash 菜单', async () => {
    const editor = await createEditor({ root: container, defaultValue: '/' });
    await wait(0);

    const view = editor.getView();
    const end = view.state.selection.$from.end();
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, end)));
    await wait(0);

    pressKey(view, 'Escape');
    await wait(0);

    const menu = container.querySelector('.colla-slash-menu') as HTMLElement;
    expect(menu.style.display).toBe('none');

    await editor.destroy();
  });

  it('非空段落不应激活 Slash 菜单', async () => {
    const editor = await createEditor({ root: container, defaultValue: 'hello /' });
    await wait(0);

    const menu = container.querySelector('.colla-slash-menu') as HTMLElement;
    expect(menu.style.display).toBe('none');

    await editor.destroy();
  });

  it('ArrowDown/ArrowUp 应循环切换选中项', async () => {
    const editor = await createEditor({ root: container, defaultValue: '/' });
    await wait(0);

    const view = editor.getView();
    const end = view.state.selection.$from.end();
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, end)));
    await wait(0);

    pressKey(view, 'ArrowDown');
    await wait(0);
    let selected = container.querySelector('.colla-slash-menu__item--selected') as HTMLElement;
    expect(selected).not.toBeNull();
    expect(selected.textContent).toBe('标题 2');

    pressKey(view, 'ArrowUp');
    await wait(0);
    selected = container.querySelector('.colla-slash-menu__item--selected') as HTMLElement;
    expect(selected.textContent).toBe('标题 1');

    await editor.destroy();
  });

  it('ArrowDown 到最后一项后再按应回到第一项', async () => {
    const editor = await createEditor({ root: container, defaultValue: '/' });
    await wait(0);

    const view = editor.getView();
    const end = view.state.selection.$from.end();
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, end)));
    await wait(0);

    const total = container.querySelectorAll('.colla-slash-menu__item').length;
    for (let i = 0; i < total; i++) {
      pressKey(view, 'ArrowDown');
      await wait(0);
    }
    const selected = container.querySelector('.colla-slash-menu__item--selected') as HTMLElement;
    expect(selected.textContent).toBe('标题 1');

    await editor.destroy();
  });

  it('ArrowUp 在第一项时按应回到最后一项', async () => {
    const editor = await createEditor({ root: container, defaultValue: '/' });
    await wait(0);

    const view = editor.getView();
    const end = view.state.selection.$from.end();
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, end)));
    await wait(0);

    pressKey(view, 'ArrowUp');
    await wait(0);
    const selected = container.querySelector('.colla-slash-menu__item--selected') as HTMLElement;
    expect(selected.textContent).toBe('表格');

    await editor.destroy();
  });

  it('段落内非文本子节点不应激活 Slash 菜单', async () => {
    const editor = await createEditor({ root: container });
    await wait(0);

    const view = editor.getView();
    const schema = view.state.schema;
    const hardbreak = schema.nodes.hardbreak!;
    const tr = view.state.tr.replaceSelectionWith(hardbreak.create());
    view.dispatch(tr);
    await wait(0);

    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 2)));
    await wait(0);

    const menu = container.querySelector('.colla-slash-menu') as HTMLElement;
    expect(menu.style.display).toBe('none');

    await editor.destroy();
  });

  it('点击菜单空白处不应执行命令', async () => {
    const editor = await createEditor({ root: container, defaultValue: '/' });
    await wait(0);

    const view = editor.getView();
    const end = view.state.selection.$from.end();
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, end)));
    await wait(0);

    const menu = container.querySelector('.colla-slash-menu') as HTMLElement;
    const list = menu.querySelector('.colla-slash-menu__list') as HTMLElement;
    const mdBefore = editor.getMarkdown();
    list.click();
    await wait(0);
    expect(editor.getMarkdown()).toBe(mdBefore);

    await editor.destroy();
  });

  it('点击菜单项应执行命令', async () => {
    const editor = await createEditor({ root: container, defaultValue: '/' });
    await wait(0);

    const view = editor.getView();
    const end = view.state.selection.$from.end();
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, end)));
    await wait(0);

    const item = container.querySelector('[data-slash-index="2"]') as HTMLElement;
    item.click();
    await wait(0);

    const md = editor.getMarkdown();
    expect(md).toMatch(/^###/m);

    await editor.destroy();
  });

  it('createDefaultSlashItems 应覆盖各类命令', async () => {
    const editor = await createEditor({ root: container });
    await wait(0);
    const items = createDefaultSlashItems(editor.getView());
    const ids = items.map((i) => i.id);
    expect(ids).toContain('heading-1');
    expect(ids).toContain('bullet-list');
    expect(ids).toContain('ordered-list');
    expect(ids).toContain('task-list');
    expect(ids).toContain('code-block');
    expect(ids).toContain('blockquote');
    expect(ids).toContain('hr');
    expect(ids).toContain('table');

    // 执行若干命令验证可用性
    const bulletItem = items.find((i) => i.id === 'bullet-list')!;
    expect(bulletItem.action(editor.getView())).toBe(true);
    expect(editor.getMarkdown()).toContain('* ');

    await editor.destroy();
  });

  it('自定义 items 应参与过滤与执行', async () => {
    const customAction = vi.fn().mockReturnValue(true);
    const plugin = createSlashCommandPlugin({
      items: [
        { id: 'custom', label: 'Custom', keywords: ['custom'], action: customAction },
      ],
    });

    // 为避免与 factory 中默认 slash 插件冲突，使用最小 Milkdown 实例测试
    const editor = await Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, container);
        ctx.set(defaultValueCtx, '/custom');
      })
      .use(commonmark)
      .use(plugin)
      .create();
    await wait(0);

    const view = editor.action((ctx) => ctx.get(editorViewCtx)) as ReturnType<typeof createEditor> extends Promise<infer T> ? T extends { getView(): infer V } ? V : never : never;
    const end = view.state.selection.$from.end();
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, end)));
    await wait(0);

    const menu = container.querySelector('.colla-slash-menu') as HTMLElement;
    const item = menu.querySelector('.colla-slash-menu__item') as HTMLElement;
    expect(item.textContent).toBe('Custom');

    item.click();
    await wait(0);
    expect(customAction).toHaveBeenCalled();

    await editor.destroy();
  });

  it('菜单应根据光标坐标定位', async () => {
    const editor = await createEditor({ root: container, defaultValue: '/' });
    await wait(0);

    const view = editor.getView();
    const end = view.state.selection.$from.end();
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, end)));
    await wait(0);

    vi.spyOn(view, 'coordsAtPos').mockReturnValue({ left: 10, right: 10, top: 5, bottom: 15 } as DOMRect);
    // 切换选中项触发菜单重定位
    pressKey(view, 'ArrowDown');
    await wait(0);

    const menu = container.querySelector('.colla-slash-menu') as HTMLElement;
    expect(menu.style.display).toBe('block');
    expect(menu.style.left).toBe('10px');
    expect(menu.style.top).toBe('19px');

    await editor.destroy();
  });

  it('菜单定位失败时应回退到 0,0', async () => {
    const editor = await createEditor({ root: container, defaultValue: '/' });
    await wait(0);

    const view = editor.getView();
    const end = view.state.selection.$from.end();
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, end)));
    await wait(0);

    vi.spyOn(view, 'coordsAtPos').mockImplementation(() => {
      throw new Error('no coords');
    });
    // 切换选中项触发菜单重定位
    pressKey(view, 'ArrowDown');
    await wait(0);

    const menu = container.querySelector('.colla-slash-menu') as HTMLElement;
    expect(menu.style.left).toBe('0px');
    expect(menu.style.top).toBe('0px');

    await editor.destroy();
  });

  it('未知按键不应拦截', async () => {
    const editor = await createEditor({ root: container, defaultValue: '/' });
    await wait(0);

    const view = editor.getView();
    const end = view.state.selection.$from.end();
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, end)));
    await wait(0);

    const event = new KeyboardEvent('keydown', { key: 'a', bubbles: true });
    const prevented = !view.dom.dispatchEvent(event);
    expect(prevented).toBe(false);

    await editor.destroy();
  });

  it('任务列表命令在已有列表项中应切换为任务项', async () => {
    const editor = await createEditor({ root: container, defaultValue: '* item' });
    await wait(0);
    const items = createDefaultSlashItems(editor.getView());
    const item = items.find((i) => i.id === 'task-list')!;

    const view = editor.getView();
    const end = view.state.selection.$from.end();
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, end)));
    await wait(0);

    item.action(view);
    expect(editor.getMarkdown()).toContain('* [ ]');

    await editor.destroy();
  });

  it.each([
    { id: 'table', marker: '|' },
    { id: 'code-block', marker: '```' },
    { id: 'blockquote', marker: '>' },
    { id: 'hr', marker: '***' },
    { id: 'ordered-list', marker: '1.' },
    { id: 'task-list', marker: '* [ ]' },
  ])('可执行 $id 命令', async ({ id, marker }) => {
    const editor = await createEditor({ root: container });
    await wait(0);
    const items = createDefaultSlashItems(editor.getView());
    const item = items.find((i) => i.id === id);
    expect(item).toBeDefined();

    await editor.setMarkdown('/');
    await wait(0);
    const view = editor.getView();
    const end = view.state.selection.$from.end();
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, end)));
    await wait(0);

    item!.action(view);
    const md = editor.getMarkdown();
    expect(md).toContain(marker);

    await editor.destroy();
  });
});
