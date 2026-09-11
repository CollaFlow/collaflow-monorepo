import { $prose } from '@milkdown/utils';
import type { MilkdownPlugin } from '@milkdown/ctx';
import { Plugin, PluginKey } from 'prosemirror-state';
import type { Node as PMNode } from 'prosemirror-model';
import type { NodeView, EditorView } from 'prosemirror-view';

const MERMAID_KEY = new PluginKey('colla-mermaid');

/** Mermaid 渲染函数签名（注入用，便于测试与替换实现）。 */
export type MermaidRenderFn = (code: string, id: string) => Promise<{ svg: string }>;

let mermaidPromise: Promise<typeof import('mermaid').default> | null = null;
let mermaidInitialized = false;

/** 懒加载 mermaid（仅当存在 mermaid 代码块时），并只初始化一次。 */
async function getMermaidRenderer(): Promise<MermaidRenderFn> {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((m) => m.default);
  }
  const mermaid = await mermaidPromise;
  if (!mermaidInitialized) {
    // securityLevel: strict 禁止在图表中执行任意 HTML，避免协同场景下 XSS
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
    mermaidInitialized = true;
  }
  return (code: string, id: string) => mermaid.render(id, code);
}

/** @internal 暴露给测试用例 */
export class MermaidView implements NodeView {
  dom: HTMLElement;
  contentDOM?: HTMLElement;

  private readonly isMermaid: boolean;
  private container?: HTMLElement;
  private lastCode?: string;
  private readonly render: MermaidRenderFn | null;
  private renderSeq = 0;

  constructor(
    node: PMNode,
    _view: EditorView,
    _getPos: () => number | undefined,
    render?: MermaidRenderFn
  ) {
    this.render = render ?? null;
    this.isMermaid = node.attrs.language === 'mermaid';
    this.dom = document.createElement('div');
    this.dom.className = 'colla-code-block';

    if (this.isMermaid) {
      this.dom.classList.add('colla-code-block--mermaid');
      this.container = document.createElement('div');
      this.container.className = 'colla-mermaid';
      this.dom.appendChild(this.container);
      // 无 contentDOM：该块在 WYSIWYG 中原子化，源码在「源码区」编辑
      void this.renderInto(node.textContent);
    } else {
      const pre = document.createElement('pre');
      const code = document.createElement('code');
      if (node.attrs.language) code.className = `language-${node.attrs.language}`;
      pre.appendChild(code);
      this.dom.appendChild(pre);
      this.contentDOM = code;
    }
  }

  private async renderInto(code: string) {
    if (!this.container) return;
    const seq = ++this.renderSeq;
    const id = `colla-mermaid-${seq}`;
    try {
      const renderFn = this.render ?? (await getMermaidRenderer());
      const { svg } = await renderFn(code, id);
      // 防止竞态：仅应用最新一次渲染结果
      if (seq !== this.renderSeq || !this.container) return;
      this.container.innerHTML = svg;
      this.container.classList.remove('colla-mermaid--error');
    } catch (err) {
      if (seq !== this.renderSeq || !this.container) return;
      this.container.classList.add('colla-mermaid--error');
      this.container.textContent = `Mermaid 渲染失败：${(err as Error).message}`;
    }
  }

  update(node: PMNode): boolean {
    if (node.type.name !== 'code_block') return false;
    const nowMermaid = node.attrs.language === 'mermaid';
    // 类别切换（mermaid ↔ 普通）需要重建节点视图
    if (nowMermaid !== this.isMermaid) return false;

    if (this.isMermaid) {
      if (node.textContent !== this.lastCode) {
        this.lastCode = node.textContent;
        void this.renderInto(node.textContent);
      }
    }
    return true;
  }
}

/**
 * Mermaid 图表插件。
 *
 * 语言为 `mermaid` 的代码块在 WYSIWYG 中渲染为图表（源码仍保留在 Y.Text 真相中，
 * 可在「源码区」编辑）；其它语言保持原样并交给 prism 高亮（prism 使用 decorations，互不冲突）。
 */
export function createMermaidPlugin(options?: { render?: MermaidRenderFn }): MilkdownPlugin {
  const render = options?.render;
  return $prose(() => {
    return new Plugin({
      key: MERMAID_KEY,
      props: {
        nodeViews: {
          code_block: (node: PMNode, view: EditorView, getPos: () => number | undefined) =>
            new MermaidView(node, view, getPos, render),
        },
      },
    });
  });
}
