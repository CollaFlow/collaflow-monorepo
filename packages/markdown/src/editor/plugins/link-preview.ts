import { $prose } from '@milkdown/utils';
import type { MilkdownPlugin } from '@milkdown/ctx';
import { Plugin, PluginKey } from 'prosemirror-state';
import type { Node } from 'prosemirror-model';
import type { NodeView, EditorView, ViewMutationRecord } from 'prosemirror-view';

const LINK_PREVIEW_KEY = new PluginKey('colla-link-preview');

/**
 * 链接卡片元数据。
 */
export interface LinkPreviewData {
  /** 卡片标题 */
  title?: string;
  /** 卡片描述 */
  description?: string;
  /** 站点图标 URL */
  favicon?: string;
}

/**
 * 链接卡片解析器：由调用方提供以异步获取链接元数据。
 */
export type LinkPreviewResolver = (url: string) => Promise<LinkPreviewData> | LinkPreviewData;

/**
 * 判断段落是否仅包含一个链接文本节点。
 */
function isStandaloneLink(node: Node): { url: string; text: string } | null {
  if (node.childCount !== 1) return null;
  const child = node.firstChild;
  if (!child || child.type.name !== 'text' || child.text == null) return null;
  const marks = child.marks;
  if (marks.length !== 1 || marks[0]?.type.name !== 'link') return null;
  const url = String(marks[0].attrs.href);
  return { url, text: child.text };
}

/** @internal 暴露给测试用例 */
export class LinkPreviewView implements NodeView {
  dom: HTMLElement;
  contentDOM: HTMLElement;
  /** @internal */
  urlEl: HTMLElement;
  /** @internal */
  metaEl: HTMLElement;
  private resolver?: LinkPreviewResolver;
  private lastResolvedUrl?: string;
  private resolving = false;

  constructor(node: Node, _view: EditorView, _getPos: () => number | undefined, resolver?: LinkPreviewResolver) {
    this.resolver = resolver;
    const link = isStandaloneLink(node);

    this.dom = document.createElement('div');
    this.dom.className = 'colla-link-card';

    if (link) {
      this.dom.classList.add('colla-link-card--preview');
      this.contentDOM = document.createElement('span');
      this.contentDOM.className = 'colla-link-card__title';
      this.urlEl = document.createElement('span');
      this.urlEl.className = 'colla-link-card__url';
      this.urlEl.textContent = link.url;
      this.metaEl = document.createElement('span');
      this.metaEl.className = 'colla-link-card__meta';

      this.dom.appendChild(this.contentDOM);
      this.dom.appendChild(this.urlEl);
      this.dom.appendChild(this.metaEl);

      this.dom.addEventListener('click', (e) => {
        if (e.target === this.urlEl || e.target === this.metaEl) {
          window.open(link.url, '_blank', 'noopener,noreferrer');
        }
      });

      void this.resolve(link.url);
    } else {
      this.dom.classList.add('colla-paragraph');
      this.contentDOM = this.dom;
      this.urlEl = document.createElement('span');
      this.metaEl = document.createElement('span');
    }
  }

  update(node: Node): boolean {
    const wasLink = this.dom.classList.contains('colla-link-card--preview');
    const link = isStandaloneLink(node);
    if (wasLink !== !!link) return false;

    if (link) {
      this.urlEl.textContent = link.url;
      void this.resolve(link.url);
    }
    return true;
  }

  ignoreMutation(record: ViewMutationRecord): boolean {
    // 忽略 meta/url 元素自身的文本更新，避免异步渲染触发 ProseMirror 重绘循环
    const target = record.target;
    if (target === this.urlEl || target === this.metaEl) return true;
    // 链接卡片的 contentDOM 为 title span，其内部编辑 mutation 交给 ProseMirror
    if (this.dom.classList.contains('colla-link-card--preview')) {
      return !this.contentDOM.contains(target);
    }
    return false;
  }

  private async resolve(url: string) {
    if (!this.resolver || this.resolving || this.lastResolvedUrl === url) return;
    this.resolving = true;
    try {
      const data = await Promise.resolve(this.resolver(url));
      this.lastResolvedUrl = url;
      if (data.description) {
        this.metaEl.textContent = `${data.title ?? ''} — ${data.description}`;
      } else if (data.title) {
        this.metaEl.textContent = data.title;
      }
    } catch {
      // 解析失败时保持原样
    } finally {
      this.resolving = false;
    }
  }
}

/**
 * 创建链接卡片预览插件。
 *
 * 段落仅包含单个链接时，渲染为卡片预览；否则保持普通段落。
 */
export function createLinkPreviewPlugin(resolver?: LinkPreviewResolver): MilkdownPlugin {
  return $prose(() => {
    return new Plugin({
      key: LINK_PREVIEW_KEY,
      props: {
        nodeViews: {
          paragraph: (node: Node, view: EditorView, getPos: () => number | undefined) =>
            new LinkPreviewView(node, view, getPos, resolver),
        },
      },
    });
  });
}
