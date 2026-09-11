import { $prose } from '@milkdown/utils';
import type { MilkdownPlugin } from '@milkdown/ctx';
import { Plugin, PluginKey } from 'prosemirror-state';
import type { EditorState } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import { setBlockType, wrapIn } from 'prosemirror-commands';

const SLASH_KEY = new PluginKey('colla-slash-command');

/**
 * Slash 命令项。
 */
export interface SlashCommandItem {
  /** 唯一标识 */
  id: string;
  /** 展示文案 */
  label: string;
  /** 搜索关键词（小写） */
  keywords: string[];
  /** 执行命令 */
  action: (view: EditorView) => boolean;
}

/**
 * Slash Command 配置。
 */
export interface SlashCommandOptions {
  /** 自定义命令列表；未提供时使用默认命令 */
  items?: SlashCommandItem[];
}

/** 创建默认 Slash 命令。 */
export function createDefaultSlashItems(view: EditorView): SlashCommandItem[] {
  const { schema } = view.state;
  const heading = schema.nodes.heading;
  const paragraph = schema.nodes.paragraph;
  const codeBlock = schema.nodes.code_block;
  const blockquote = schema.nodes.blockquote;
  const bulletList = schema.nodes.bullet_list;
  const orderedList = schema.nodes.ordered_list;
  const listItem = schema.nodes.list_item;
  const hr = schema.nodes.hr;
  const table = schema.nodes.table;

  const items: SlashCommandItem[] = [];

  if (heading) {
    for (let level = 1; level <= 3; level++) {
      items.push({
        id: `heading-${level}`,
        label: `标题 ${level}`,
        keywords: ['heading', 'h', '标题'],
        action: (v) => setBlockType(heading, { level })(v.state, v.dispatch),
      });
    }
  }

  if (bulletList && listItem) {
    items.push({
      id: 'bullet-list',
      label: '无序列表',
      keywords: ['bullet', 'unordered', 'list', '无序列表'],
      action: (v) => wrapIn(bulletList)(v.state, v.dispatch),
    });
  }

  if (orderedList && listItem) {
    items.push({
      id: 'ordered-list',
      label: '有序列表',
      keywords: ['ordered', 'list', '有序列表'],
      action: (v) => wrapIn(orderedList)(v.state, v.dispatch),
    });
  }

  if (listItem && paragraph && bulletList) {
    items.push({
      id: 'task-list',
      label: '任务列表',
      keywords: ['task', 'todo', 'checkbox', '任务列表'],
      action: (v) => {
        const { state, dispatch } = v;
        const { $from } = state.selection;
        const tr = state.tr;

        let listItemDepth = -1;
        for (let d = $from.depth; d > 0; d--) {
          if ($from.node(d).type.name === 'list_item') {
            listItemDepth = d;
            break;
          }
        }

        if (listItemDepth > 0) {
          const nodeAtDepth = $from.node(listItemDepth);
          tr.setNodeMarkup($from.before(listItemDepth), listItem, {
            ...nodeAtDepth.attrs,
            checked: false,
          });
        } else {
          const start = $from.start($from.depth);
          const end = $from.end($from.depth);
          tr.replaceWith(
            start,
            end,
            bulletList.create(null, [listItem.create({ checked: false }, paragraph.create(null))])
          );
        }
        dispatch?.(tr.scrollIntoView());
        return true;
      },
    });
  }

  if (codeBlock) {
    items.push({
      id: 'code-block',
      label: '代码块',
      keywords: ['code', 'codeblock', '代码块'],
      action: (v) => setBlockType(codeBlock)(v.state, v.dispatch),
    });
  }

  if (blockquote) {
    items.push({
      id: 'blockquote',
      label: '引用',
      keywords: ['quote', 'blockquote', '引用'],
      action: (v) => wrapIn(blockquote)(v.state, v.dispatch),
    });
  }

  if (hr) {
    items.push({
      id: 'hr',
      label: '分割线',
      keywords: ['hr', 'divider', 'horizontal', '分割线'],
      action: (v) => {
        const { state, dispatch } = v;
        const { $from } = state.selection;
        const tr = state.tr.replaceWith($from.before($from.depth), $from.after($from.depth), hr.create());
        dispatch?.(tr.scrollIntoView());
        return true;
      },
    });
  }

  if (table) {
    items.push({
      id: 'table',
      label: '表格',
      keywords: ['table', '表格'],
      action: (v) => {
        const { state, dispatch } = v;
        const tableRow = state.schema.nodes.table_row;
        const tableCell = state.schema.nodes.table_cell;
        const tableHeader = state.schema.nodes.table_header;
        const paragraphNode = state.schema.nodes.paragraph;
        /* c8 ignore next */
        if (!tableRow || !tableCell || !tableHeader || !paragraphNode) return false;
        const headerRow = tableRow.create(null, [
          tableHeader.create(null, paragraphNode.create(null)),
          tableHeader.create(null, paragraphNode.create(null)),
        ]);
        const bodyRow = tableRow.create(null, [
          tableCell.create(null, paragraphNode.create(null)),
          tableCell.create(null, paragraphNode.create(null)),
        ]);
        const tableNode = table.create(null, [headerRow, bodyRow]);
        const { $from } = state.selection;
        const tr = state.tr.replaceWith($from.before($from.depth), $from.after($from.depth), tableNode);
        dispatch?.(tr.scrollIntoView());
        return true;
      },
    });
  }

  return items;
}

interface SlashState {
  active: boolean;
  query: string;
  selected: number;
  items: SlashCommandItem[];
}

const DEFAULT_STATE: SlashState = {
  active: false,
  query: '',
  selected: 0,
  items: [],
};

class SlashMenu {
  private view: EditorView | null = null;
  private dom: HTMLElement;
  private list: HTMLElement;

  constructor() {
    this.dom = document.createElement('div');
    this.dom.className = 'colla-slash-menu';
    this.dom.style.display = 'none';
    this.dom.style.position = 'absolute';
    this.dom.style.zIndex = '100';

    this.list = document.createElement('div');
    this.list.className = 'colla-slash-menu__list';
    this.dom.appendChild(this.list);

    this.list.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest('[data-slash-index]') as HTMLElement | null;
      if (!target || !this.view) return;
      const index = Number(target.dataset.slashIndex);
      const state = SLASH_KEY.getState(this.view.state) as SlashState;
      const item = state.items[index];
      if (item) this.execute(item);
    });
  }

  mount(view: EditorView) {
    this.view = view;
    view.dom.parentElement?.appendChild(this.dom);
  }

  destroy() {
    this.dom.remove();
    this.view = null;
  }

  update(view: EditorView, prevState?: unknown) {
    const state = SLASH_KEY.getState(view.state) as SlashState;
    /* c8 ignore next */
    const prev = prevState ? (SLASH_KEY.getState(prevState as never) as SlashState) : null;
    if (
      state?.active === prev?.active &&
      state?.query === prev?.query &&
      state?.selected === prev?.selected &&
      state?.items.length === prev?.items.length
    ) {
      return;
    }

    if (!state?.active) {
      this.dom.style.display = 'none';
      return;
    }

    this.dom.style.display = 'block';
    this.position(view);
    this.render(state);
  }

  private position(view: EditorView) {
    const { from } = view.state.selection;
    try {
      const coords = view.coordsAtPos(from);
      const parentRect = view.dom.parentElement?.getBoundingClientRect();
      if (parentRect) {
        this.dom.style.left = `${coords.left - parentRect.left}px`;
        this.dom.style.top = `${coords.bottom - parentRect.top + 4}px`;
        /* c8 ignore start */
      } else {
        // 编辑器 dom 未挂载到父容器时的防御性回退（测试环境难以构造）
        this.dom.style.left = `${coords.left}px`;
        this.dom.style.top = `${coords.bottom + 4}px`;
      }
      /* c8 ignore stop */
    } catch {
      this.dom.style.left = '0px';
      this.dom.style.top = '0px';
    }
  }

  private render(state: SlashState) {
    this.list.innerHTML = '';
    state.items.forEach((item, index) => {
      const el = document.createElement('div');
      el.className = 'colla-slash-menu__item';
      el.dataset.slashIndex = String(index);
      if (index === state.selected) el.classList.add('colla-slash-menu__item--selected');
      el.textContent = item.label;
      this.list.appendChild(el);
    });
  }

  execute(item: SlashCommandItem) {
    const view = this.view;
    /* c8 ignore next */
    if (!view) return;

    const state = SLASH_KEY.getState(view.state) as SlashState;
    const { $from } = view.state.selection;
    const queryLen = state.query.length;
    const slashPos = $from.pos - queryLen - 1;

    const tr = view.state.tr
      .setMeta(SLASH_KEY, { close: true })
      .delete(slashPos, $from.pos);
    view.dispatch(tr);

    item.action(view);
  }
}

function filterItems(items: SlashCommandItem[], query: string): SlashCommandItem[] {
  if (!query) return items;
  const q = query.toLowerCase();
  return items.filter(
    (item) => item.keywords.some((k) => k.toLowerCase().includes(q)) || item.label.toLowerCase().includes(q)
  );
}

interface SlashMeta {
  close?: boolean;
  selected?: number;
}

function readSlashQuery(source: { selection: EditorState['selection'] }): { active: boolean; query: string } {
  const { selection } = source;
  if (!selection.empty) return { active: false, query: '' };
  const { $from } = selection;
  const paragraph = $from.parent;
  if (paragraph.type.name !== 'paragraph' || paragraph.childCount !== 1) return { active: false, query: '' };
  const child = paragraph.firstChild;
  if (!child || child.type.name !== 'text' || child.text == null) return { active: false, query: '' };
  const text = child.text;
  const textEnd = $from.parentOffset;
  // 仅当光标位于文本末尾且文本以 / 开头时激活
  if (textEnd !== text.length || !text.startsWith('/')) return { active: false, query: '' };
  return { active: true, query: text.slice(1) };
}

/**
 * 创建 Slash Command 插件。
 */
export function createSlashCommandPlugin(options?: SlashCommandOptions): MilkdownPlugin {
  return $prose(() => {
    const menu = new SlashMenu();
    let allItems: SlashCommandItem[] = [];

    return new Plugin({
      key: SLASH_KEY,
      state: {
        init(): SlashState {
          return DEFAULT_STATE;
        },
        apply(tr, value: SlashState): SlashState {
          const meta = tr.getMeta(SLASH_KEY) as SlashMeta | undefined;
          if (meta?.close) {
            return { ...value, active: false, query: '', selected: 0, items: [] };
          }

          const { active, query } = readSlashQuery(tr);
          if (!active) {
            return { active: false, query: '', selected: 0, items: [] };
          }

          const filtered = filterItems(allItems, query);
          let selected = value.selected;
          if (meta?.selected != null) {
            selected = meta.selected;
          } else if (query !== value.query) {
            selected = 0;
          }
          selected = Math.min(selected, Math.max(0, filtered.length - 1));

          return { active: true, query, selected, items: filtered };
        },
      },
      props: {
        handleKeyDown(view, event) {
          const state = SLASH_KEY.getState(view.state) as SlashState | undefined;
          /* c8 ignore next */
          if (!state?.active) return false;

          if (event.key === 'ArrowDown') {
            view.dispatch(view.state.tr.setMeta(SLASH_KEY, { selected: state.selected < state.items.length - 1 ? state.selected + 1 : 0 }));
            return true;
          }
          if (event.key === 'ArrowUp') {
            view.dispatch(view.state.tr.setMeta(SLASH_KEY, { selected: state.selected > 0 ? state.selected - 1 : state.items.length - 1 }));
            return true;
          }
          if (event.key === 'Enter') {
            const item = state.items[state.selected];
            if (item) menu.execute(item);
            return true;
          }
          if (event.key === 'Escape') {
            view.dispatch(view.state.tr.setMeta(SLASH_KEY, { close: true }));
            return true;
          }
          return false;
        },
      },
      view(editorView) {
        allItems = options?.items ?? createDefaultSlashItems(editorView);
        menu.mount(editorView);
        return {
          update: (view, prevState) => menu.update(view, prevState),
          destroy: () => menu.destroy(),
        };
      },
    });
  });
}
