import { $prose } from '@milkdown/utils';
import type { Ctx, MilkdownPlugin } from '@milkdown/ctx';
import { BlockProvider } from '@milkdown/plugin-block';
import { Plugin, PluginKey } from 'prosemirror-state';
import { setBlockType, wrapIn, lift } from 'prosemirror-commands';
import type { EditorView } from 'prosemirror-view';

/**
 * 块类型转换菜单项。
 */
export interface BlockConversionItem {
  /** 唯一标识 */
  id: string;
  /** 展示文案 */
  label: string;
  /** 执行转换，返回是否生效 */
  run: () => boolean;
}

/**
 * 创建左侧悬浮块把手 DOM。
 *
 * 由 `BlockProvider` 接管：自身可拖拽（拖拽即重排块），内含「+」按钮用于打开块类型转换菜单。
 */
export function createBlockHandleElement(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'colla-block-handle';
  el.setAttribute('draggable', 'true');

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'colla-block-handle__add';
  addBtn.textContent = '+';
  addBtn.setAttribute('aria-label', '转换块类型');
  addBtn.contentEditable = 'false';

  const drag = document.createElement('span');
  drag.className = 'colla-block-handle__drag';
  drag.textContent = '⠿';
  drag.contentEditable = 'false';

  el.appendChild(addBtn);
  el.appendChild(drag);
  return el;
}

/**
 * 构建当前选块可用的转换项。
 *
 * 命令作用于编辑器当前选区（块把手点击时块已被选中为 NodeSelection），
 * 复用 `setBlockType` / `wrapIn` 等标准 ProseMirror 命令。
 */
export function buildConversionItems(view: EditorView): BlockConversionItem[] {
  const { schema } = view.state;
  const items: BlockConversionItem[] = [];

  const paragraph = schema.nodes.paragraph;
  const heading = schema.nodes.heading;
  const bulletList = schema.nodes.bullet_list;
  const orderedList = schema.nodes.ordered_list;
  const listItem = schema.nodes.list_item;
  const blockquote = schema.nodes.blockquote;
  const codeBlock = schema.nodes.code_block;

  if (paragraph) {
    items.push({
      id: 'text',
      label: '文本',
      run: () => setBlockType(paragraph)(view.state, view.dispatch) || lift(view.state, view.dispatch),
    });
  }

  if (heading) {
    for (let level = 1; level <= 3; level++) {
      items.push({
        id: `heading-${level}`,
        label: `标题 ${level}`,
        run: () => setBlockType(heading, { level })(view.state, view.dispatch),
      });
    }
  }

  if (bulletList && listItem) {
    items.push({
      id: 'bullet-list',
      label: '无序列表',
      run: () => wrapIn(bulletList)(view.state, view.dispatch),
    });
  }

  if (orderedList && listItem) {
    items.push({
      id: 'ordered-list',
      label: '有序列表',
      run: () => wrapIn(orderedList)(view.state, view.dispatch),
    });
  }

  if (bulletList && listItem && paragraph) {
    items.push({
      id: 'task-list',
      label: '待办列表',
      run: () => {
        const { state, dispatch } = view;
        if (!wrapIn(bulletList)(state, dispatch)) return false;
        // wrapIn 已派发，重新解析新选区找到 list_item 并标记 checked
        const $from = view.state.selection.$from;
        for (let depth = $from.depth; depth > 0; depth--) {
          const node = $from.node(depth);
          if (node.type.name === 'list_item' && node.attrs.checked == null) {
            const tr = view.state.tr.setNodeMarkup($from.before(depth), undefined, {
              ...node.attrs,
              checked: false,
            });
            view.dispatch(tr);
            break;
          }
        }
        return true;
      },
    });
  }

  if (blockquote) {
    items.push({
      id: 'blockquote',
      label: '引用',
      run: () => wrapIn(blockquote)(view.state, view.dispatch),
    });
  }

  if (codeBlock) {
    items.push({
      id: 'code-block',
      label: '代码块',
      run: () => setBlockType(codeBlock)(view.state, view.dispatch),
    });
  }

  return items;
}

/** @internal 暴露给测试用例 */
export function createMenuElement(): HTMLElement {
  const menu = document.createElement('div');
  menu.className = 'colla-block-menu';
  menu.style.display = 'none';
  return menu;
}

/**
 * 左侧块把手插件：在悬浮块左侧渲染 Notion 式把手，支持拖拽重排与块类型转换。
 *
 * 底层复用 `@milkdown/plugin-block` 的 `BlockService`（已在 `factory` 中 `.use(block)` 注册），
 * 通过 `BlockProvider` 接管把手 DOM 与转换菜单。
 */
export const blockHandlePlugin: MilkdownPlugin = $prose((ctx: Ctx) => {
  let provider: BlockProvider | null = null;
  let menu: HTMLElement | null = null;
  let menuOpen = false;

  function closeMenu() {
    menuOpen = false;
    document.removeEventListener('mousedown', onDocDown, true);
    menu?.remove();
    menu = null;
  }

  function onDocDown(event: MouseEvent) {
    if (menu && !menu.contains(event.target as Node)) closeMenu();
  }

  return new Plugin({
    key: new PluginKey('colla-block-handle'),
    view(editorView: EditorView) {
      const handleEl = createBlockHandleElement();
      provider = new BlockProvider({
        ctx,
        content: handleEl,
        root: editorView.dom.parentElement ?? undefined,
        getPlacement: () => 'left',
        getOffset: () => ({ mainAxis: -4, crossAxis: 0 }),
      });
      provider.update();

      const addBtn = handleEl.querySelector('.colla-block-handle__add') as HTMLElement;

      const openMenu = () => {
        if (menuOpen) {
          closeMenu();
          return;
        }
        menuOpen = true;
        menu = createMenuElement();
        buildConversionItems(editorView).forEach((item) => {
          const el = document.createElement('div');
          el.className = 'colla-block-menu__item';
          el.textContent = item.label;
          el.addEventListener('mousedown', (e) => {
            e.preventDefault();
            item.run();
            closeMenu();
          });
          menu!.appendChild(el);
        });
        document.body.appendChild(menu);
        const rect = handleEl.getBoundingClientRect();
        menu.style.left = `${rect.left}px`;
        menu.style.top = `${rect.bottom + 4}px`;
        menu.style.display = 'block';
        setTimeout(() => document.addEventListener('mousedown', onDocDown, true), 0);
      };

      addBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openMenu();
      });

      return {
        destroy() {
          closeMenu();
          provider?.destroy();
          provider = null;
        },
      };
    },
  });
});
