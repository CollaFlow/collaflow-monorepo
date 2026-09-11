import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createEditor } from '../src/index';
import { ImageCardView } from '../src/editor/plugins/image-card';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('@collaflow/markdown/image-card', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('应将图片渲染为卡片容器并携带 alt 标题', async () => {
    const editor = await createEditor({
      root: container,
      defaultValue: '![diagram](https://example.com/diagram.png "tooltip")',
    });
    await wait(0);

    const card = container.querySelector('.colla-image-card') as HTMLElement;
    expect(card).not.toBeNull();

    const img = card.querySelector('img') as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.src).toBe('https://example.com/diagram.png');
    expect(img.alt).toBe('diagram');
    expect(img.title).toBe('tooltip');

    const caption = card.querySelector('.colla-image-card__caption') as HTMLElement;
    expect(caption).not.toBeNull();
    expect(caption.textContent).toBe('diagram');

    await editor.destroy();
  });

  it('无 alt 时不渲染标题行', async () => {
    const editor = await createEditor({
      root: container,
      defaultValue: '![](https://example.com/pic.png)',
    });
    await wait(0);

    const card = container.querySelector('.colla-image-card') as HTMLElement;
    expect(card.querySelector('.colla-image-card__caption')).toBeNull();

    await editor.destroy();
  });

  it('update 应动态添加/移除标题并更新 title', async () => {
    const editor = await createEditor({ root: container });
    await wait(0);
    const schema = editor.getView().state.schema;
    const imageNode = schema.nodes.image!.create({ src: 'https://example.com/x.png', alt: '', title: '' });

    const view = new ImageCardView(imageNode);
    expect(view.dom.querySelector('.colla-image-card__caption')).toBeNull();

    const withAlt = schema.nodes.image!.create({ src: 'https://example.com/x.png', alt: 'new alt', title: 'tip' });
    expect(view.update(withAlt)).toBe(true);
    expect(view.img.title).toBe('tip');
    const caption = view.dom.querySelector('.colla-image-card__caption') as HTMLElement;
    expect(caption).not.toBeNull();
    expect(caption.textContent).toBe('new alt');

    const noAlt = schema.nodes.image!.create({ src: 'https://example.com/x.png', alt: '' });
    expect(view.update(noAlt)).toBe(true);
    expect(view.dom.querySelector('.colla-image-card__caption')).toBeNull();

    await editor.destroy();
  });

  it('update 非图片节点应返回 false', async () => {
    const editor = await createEditor({ root: container });
    await wait(0);
    const schema = editor.getView().state.schema;
    const imageNode = schema.nodes.image!.create({ src: 'https://example.com/x.png' });
    const paragraphNode = schema.nodes.paragraph!.create();

    const view = new ImageCardView(imageNode);
    expect(view.update(paragraphNode)).toBe(false);

    await editor.destroy();
  });

  it('selectNode/deselectNode 应切换选中样式', async () => {
    const editor = await createEditor({ root: container });
    await wait(0);
    const schema = editor.getView().state.schema;
    const imageNode = schema.nodes.image!.create({ src: 'https://example.com/x.png' });
    const view = new ImageCardView(imageNode);

    view.selectNode();
    expect(view.dom.classList.contains('colla-image-card--selected')).toBe(true);
    view.deselectNode();
    expect(view.dom.classList.contains('colla-image-card--selected')).toBe(false);

    await editor.destroy();
  });

  it('update 在已有 caption 时应更新文本', async () => {
    const editor = await createEditor({ root: container });
    await wait(0);
    const schema = editor.getView().state.schema;
    const view = new ImageCardView(schema.nodes.image!!.create({ src: 'https://example.com/x.png', alt: 'old' }));
    view.update(schema.nodes.image!!.create({ src: 'https://example.com/x.png', alt: 'new' }));
    expect(view.dom.querySelector('.colla-image-card__caption')?.textContent).toBe('new');
    expect(view.stopEvent()).toBe(true);
    await editor.destroy();
  });
});
