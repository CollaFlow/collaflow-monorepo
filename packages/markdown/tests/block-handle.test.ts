import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TextSelection } from 'prosemirror-state';

import { createEditor } from '../src/index';
import {
  buildConversionItems,
  createBlockHandleElement,
} from '../src/editor/plugins/block-handle';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('@collaflow/markdown/block-handle', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  describe('createBlockHandleElement', () => {
    it('应创建带 + 与拖拽把手的块把手元素', () => {
      const el = createBlockHandleElement();
      expect(el.className).toBe('colla-block-handle');
      expect(el.querySelector('.colla-block-handle__add')).not.toBeNull();
      expect(el.querySelector('.colla-block-handle__drag')).not.toBeNull();
    });
  });

  describe('integration', () => {
    it('编辑器挂载后应在 DOM 中渲染块把手', async () => {
      const editor = await createEditor({ root: container, defaultValue: '# 标题' });
      await wait(50);

      const handle = container.querySelector('.colla-block-handle');
      expect(handle).not.toBeNull();

      await editor.destroy();
    });
  });

  describe('buildConversionItems', () => {
    it('段落应可转换为各级标题', async () => {
      const editor = await createEditor({ root: container, defaultValue: 'hello' });
      const view = editor.getView();
      const pos = view.state.selection.$from.pos;
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)));

      const heading1 = buildConversionItems(view).find((i) => i.id === 'heading-1');
      expect(heading1).toBeDefined();
      expect(heading1!.run()).toBe(true);
      expect(editor.getMarkdown()).toMatch(/^# hello/m);

      await editor.destroy();
    });

    it('段落应可转换为无序列表', async () => {
      const editor = await createEditor({ root: container, defaultValue: 'hello' });
      const view = editor.getView();
      const pos = view.state.selection.$from.pos;
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)));

      const bullet = buildConversionItems(view).find((i) => i.id === 'bullet-list');
      expect(bullet!.run()).toBe(true);
      expect(editor.getMarkdown()).toMatch(/^\* hello/m);

      await editor.destroy();
    });

    it('段落应可转换为代码块', async () => {
      const editor = await createEditor({ root: container, defaultValue: 'hello' });
      const view = editor.getView();
      const pos = view.state.selection.$from.pos;
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)));

      const code = buildConversionItems(view).find((i) => i.id === 'code-block');
      expect(code!.run()).toBe(true);
      expect(editor.getMarkdown()).toMatch(/^```/m);

      await editor.destroy();
    });

    it('段落应可转换为待办列表（带 checked 属性）', async () => {
      const editor = await createEditor({ root: container, defaultValue: 'todo' });
      const view = editor.getView();
      const pos = view.state.selection.$from.pos;
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)));

      const task = buildConversionItems(view).find((i) => i.id === 'task-list');
      expect(task!.run()).toBe(true);
      expect(editor.getMarkdown()).toMatch(/\* \[ \]/);

      await editor.destroy();
    });

    it('列表项转为「文本」应通过 lift 还原为普通段落', async () => {
      const editor = await createEditor({ root: container, defaultValue: 'hello' });
      const view = editor.getView();
      const pos = view.state.selection.$from.pos;
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)));

      buildConversionItems(view).find((i) => i.id === 'bullet-list')!.run();
      expect(editor.getMarkdown()).toMatch(/^\* hello/m);

      const text = buildConversionItems(view).find((i) => i.id === 'text');
      expect(text!.run()).toBe(true);
      expect(editor.getMarkdown()).not.toMatch(/^\* /m);
      expect(editor.getMarkdown()).toMatch(/^hello/m);

      await editor.destroy();
    });
  });
});
