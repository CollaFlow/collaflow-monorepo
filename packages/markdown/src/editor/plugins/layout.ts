import { $node } from '@milkdown/utils';
import type { MilkdownPlugin } from '@milkdown/ctx';
import type { NodeSchema } from '@milkdown/transformer';

/**
 * 空 Markdown 解析/序列化配置。
 *
 * 当前布局节点主要支持编辑器内渲染与 HTML 输出，
 * Markdown 双向转换将在后续阶段通过 remark 插件完善。
 */
// 布局节点暂不支持 Markdown 双向转换：match 恒为 false，runner 永不执行。
/* v8 ignore start */
const emptyMarkdownSpec: Pick<NodeSchema, 'parseMarkdown' | 'toMarkdown'> = {
  parseMarkdown: {
    match: () => false,
    runner: () => {},
  },
  toMarkdown: {
    match: () => false,
    runner: () => {},
  },
};
/* v8 ignore stop */

/**
 * Callout 提示框节点。
 *
 * HTML 输出：<div class="callout callout--info" data-type="info">...</div>
 */
export const calloutNode = $node('callout', () => ({
  group: 'block',
  content: 'block+',
  attrs: {
    type: { default: 'info' },
  },
  parseDOM: [
    {
      tag: 'div.callout',
      getAttrs: (dom) => {
        const element = dom as HTMLElement;
        return { type: element.dataset.type ?? 'info' };
      },
    },
  ],
  toDOM: (node) => [
    'div',
    { class: `callout callout--${node.attrs.type}`, 'data-type': node.attrs.type },
    0,
  ],
  ...emptyMarkdownSpec,
}));

/**
 * 分栏容器节点。
 */
export const columnsNode = $node('columns', () => ({
  group: 'block',
  content: 'column+',
  attrs: {
    columns: { default: 2 },
  },
  parseDOM: [
    {
      tag: 'div.columns',
      getAttrs: (dom) => {
        const element = dom as HTMLElement;
        return { columns: Number(element.dataset.columns) || 2 };
      },
    },
  ],
  toDOM: (node) => ['div', { class: 'columns', 'data-columns': node.attrs.columns }, 0],
  ...emptyMarkdownSpec,
}));

/**
 * 单栏节点。
 */
export const columnNode = $node('column', () => ({
  group: 'block',
  content: 'block+',
  parseDOM: [{ tag: 'div.column' }],
  toDOM: () => ['div', { class: 'column' }, 0],
  ...emptyMarkdownSpec,
}));

/**
 * 卡片容器节点。
 */
export const cardNode = $node('card', () => ({
  group: 'block',
  content: 'block+',
  attrs: {
    title: { default: '' },
  },
  parseDOM: [
    {
      tag: 'div.card',
      getAttrs: (dom) => {
        const element = dom as HTMLElement;
        return { title: element.dataset.title ?? '' };
      },
    },
  ],
  toDOM: (node) => ['div', { class: 'card', 'data-title': node.attrs.title }, 0],
  ...emptyMarkdownSpec,
}));

/**
 * 布局节点插件集合。
 */
export const layoutNodes: MilkdownPlugin[] = [
  calloutNode,
  columnsNode,
  columnNode,
  cardNode,
];
