import { $prose } from '@milkdown/utils';
import type { MilkdownPlugin } from '@milkdown/ctx';
import { Plugin, PluginKey } from 'prosemirror-state';
import type { Node } from 'prosemirror-model';
import type { NodeView, EditorView } from 'prosemirror-view';

const IMAGE_CARD_KEY = new PluginKey('colla-image-card');

function createCaption(alt: string): HTMLElement {
  const caption = document.createElement('div');
  caption.className = 'colla-image-card__caption';
  caption.textContent = alt;
  return caption;
}

/** @internal 暴露给测试用例 */
export class ImageCardView implements NodeView {
  dom: HTMLElement;
  img: HTMLImageElement;
  private caption: HTMLElement | null = null;

  constructor(node: Node) {
    this.dom = document.createElement('div');
    this.dom.className = 'colla-image-card';
    this.dom.setAttribute('contenteditable', 'false');
    this.dom.draggable = false;

    this.img = document.createElement('img');
    this.img.src = String(node.attrs.src);
    this.img.alt = String(node.attrs.alt);
    const title = node.attrs.title;
    if (title) this.img.title = String(title);
    this.dom.appendChild(this.img);

    const alt = String(node.attrs.alt);
    if (alt) {
      this.caption = createCaption(alt);
      this.dom.appendChild(this.caption);
    }
  }

  update(node: Node): boolean {
    if (node.type.name !== 'image') return false;

    this.img.src = String(node.attrs.src);
    this.img.alt = String(node.attrs.alt);
    const title = node.attrs.title;
    if (title) this.img.title = String(title);

    const alt = String(node.attrs.alt);
    if (alt && this.caption) {
      this.caption.textContent = alt;
    } else if (alt && !this.caption) {
      this.caption = createCaption(alt);
      this.dom.appendChild(this.caption);
    } else if (!alt && this.caption) {
      this.caption.remove();
      this.caption = null;
    }

    return true;
  }

  selectNode() {
    this.dom.classList.add('colla-image-card--selected');
  }

  deselectNode() {
    this.dom.classList.remove('colla-image-card--selected');
  }

  stopEvent(): boolean {
    return true;
  }
}

/**
 * 图片卡片化节点视图插件。
 *
 * 将 Markdown 图片节点渲染为带标题的卡片容器，
 * 选中时显示 design-token 边框高亮。
 */
export const imageCardPlugin: MilkdownPlugin = $prose(() => {
  return new Plugin({
    key: IMAGE_CARD_KEY,
    props: {
      nodeViews: {
        image: (node: Node, _view: EditorView, _getPos: () => number | undefined) => new ImageCardView(node),
      },
    },
  });
});
