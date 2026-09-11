import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createEditor } from '../src/index';
import { LinkPreviewView } from '../src/editor/plugins/link-preview';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function mutation(target: Node): MutationRecord {
  return { target, type: 'characterData' } as unknown as MutationRecord;
}

describe('@collaflow/markdown/link-preview', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('独立链接段落应渲染为链接卡片', async () => {
    const editor = await createEditor({
      root: container,
      defaultValue: '[Example](https://example.com)',
    });
    await wait(0);

    const card = container.querySelector('.colla-link-card--preview') as HTMLElement;
    expect(card).not.toBeNull();

    const url = card.querySelector('.colla-link-card__url') as HTMLElement;
    expect(url.textContent).toBe('https://example.com');

    await editor.destroy();
  });

  it('普通段落不应渲染为链接卡片', async () => {
    const editor = await createEditor({
      root: container,
      defaultValue: 'Check out [Example](https://example.com) here',
    });
    await wait(0);

    const card = container.querySelector('.colla-link-card--preview');
    expect(card).toBeNull();

    await editor.destroy();
  });

  it('resolver 返回的元数据应渲染到卡片', async () => {
    const resolver = vi.fn().mockResolvedValue({ title: 'Example Site', description: 'A sample page' });
    const editor = await createEditor({
      root: container,
      defaultValue: '[Example](https://example.com)',
      linkPreviewResolver: resolver,
    });
    await wait(10);

    expect(resolver).toHaveBeenCalledWith('https://example.com');
    const meta = container.querySelector('.colla-link-card__meta') as HTMLElement;
    expect(meta.textContent).toContain('Example Site');
    expect(meta.textContent).toContain('A sample page');

    await editor.destroy();
  });

  it('resolver 返回空数据时保持 meta 为空', async () => {
    const resolver = vi.fn().mockResolvedValue({});
    const editor = await createEditor({ root: container });
    await wait(0);
    const schema = editor.getView().state.schema;
    const linkMark = schema.marks.link!.create({ href: 'https://example.com' });
    const linkParagraph = schema.nodes.paragraph!.create(null, schema.text('Example', [linkMark]));

    const view = new LinkPreviewView(linkParagraph, editor.getView(), () => 1, resolver);
    await wait(0);
    expect(view.metaEl.textContent).toBe('');

    await editor.destroy();
  });

  it('resolver 仅返回 description 时应渲染描述', async () => {
    const resolver = vi.fn().mockResolvedValue({ description: 'Only Description' });
    const editor = await createEditor({ root: container });
    await wait(0);
    const schema = editor.getView().state.schema;
    const linkMark = schema.marks.link!.create({ href: 'https://example.com' });
    const linkParagraph = schema.nodes.paragraph!.create(null, schema.text('Example', [linkMark]));

    const view = new LinkPreviewView(linkParagraph, editor.getView(), () => 1, resolver);
    await wait(10);
    expect(view.metaEl.textContent).toBe(' — Only Description');

    await editor.destroy();
  });

  it('resolver 仅返回 title 时应渲染标题', async () => {
    const resolver = vi.fn().mockResolvedValue({ title: 'Only Title' });
    const editor = await createEditor({ root: container });
    await wait(0);
    const schema = editor.getView().state.schema;
    const linkMark = schema.marks.link!.create({ href: 'https://example.com' });
    const linkParagraph = schema.nodes.paragraph!.create(null, schema.text('Example', [linkMark]));

    const view = new LinkPreviewView(linkParagraph, editor.getView(), () => 1, resolver);
    await wait(10);
    expect(view.metaEl.textContent).toBe('Only Title');

    await editor.destroy();
  });

  it('update 在链接/普通段落间切换应返回 false', async () => {
    const editor = await createEditor({ root: container });
    await wait(0);
    const schema = editor.getView().state.schema;
    const linkMark = schema.marks.link!.create({ href: 'https://example.com' });
    const linkParagraph = schema.nodes.paragraph!.create(null, schema.text('Example', [linkMark]));
    const normalParagraph = schema.nodes.paragraph!.create(null, schema.text('hello'));

    const view = new LinkPreviewView(linkParagraph, editor.getView(), () => 1);
    expect(view.update(normalParagraph)).toBe(false);

    const view2 = new LinkPreviewView(normalParagraph, editor.getView(), () => 1);
    expect(view2.update(linkParagraph)).toBe(false);

    await editor.destroy();
  });

  it('ignoreMutation 应忽略 url/meta 元素更新', async () => {
    const editor = await createEditor({ root: container });
    await wait(0);
    const schema = editor.getView().state.schema;
    const linkMark = schema.marks.link!.create({ href: 'https://example.com' });
    const linkParagraph = schema.nodes.paragraph!.create(null, schema.text('Example', [linkMark]));

    const view = new LinkPreviewView(linkParagraph, editor.getView(), () => 1);
    expect(view.ignoreMutation(mutation(view.urlEl))).toBe(true);
    expect(view.ignoreMutation(mutation(view.metaEl))).toBe(true);
    expect(view.ignoreMutation(mutation(view.contentDOM))).toBe(false);

    await editor.destroy();
  });

  it('resolver 异常应被吞掉', async () => {
    const resolver = vi.fn().mockRejectedValue(new Error('fail'));
    const editor = await createEditor({ root: container });
    await wait(0);
    const schema = editor.getView().state.schema;
    const linkMark = schema.marks.link!.create({ href: 'https://example.com' });
    const linkParagraph = schema.nodes.paragraph!.create(null, schema.text('Example', [linkMark]));

    const view = new LinkPreviewView(linkParagraph, editor.getView(), () => 1, resolver);
    await wait(10);
    expect(resolver).toHaveBeenCalledWith('https://example.com');
    expect(view.dom.querySelector('.colla-link-card__meta')?.textContent).toBe('');

    await editor.destroy();
  });

  it('update 同类型链接时应更新 URL 并再次解析', async () => {
    const resolver = vi.fn().mockResolvedValue({ title: 'T' });
    const editor = await createEditor({ root: container });
    await wait(0);
    const schema = editor.getView().state.schema;
    const linkMark1 = schema.marks.link!.create({ href: 'https://a.com' });
    const linkMark2 = schema.marks.link!.create({ href: 'https://b.com' });
    const p1 = schema.nodes.paragraph!.create(null, schema.text('A', [linkMark1]));
    const p2 = schema.nodes.paragraph!.create(null, schema.text('B', [linkMark2]));

    const view = new LinkPreviewView(p1, editor.getView(), () => 1, resolver);
    await wait(0);
    view.update(p2);
    await wait(0);
    expect(view.urlEl.textContent).toBe('https://b.com');
    expect(resolver).toHaveBeenCalledWith('https://b.com');

    await editor.destroy();
  });

  it('点击 url 应尝试打开链接', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const editor = await createEditor({ root: container });
    await wait(0);
    const schema = editor.getView().state.schema;
    const linkMark = schema.marks.link!.create({ href: 'https://example.com' });
    const linkParagraph = schema.nodes.paragraph!.create(null, schema.text('Example', [linkMark]));

    const view = new LinkPreviewView(linkParagraph, editor.getView(), () => 1);
    view.urlEl.click();
    expect(openSpy).toHaveBeenCalledWith('https://example.com', '_blank', 'noopener,noreferrer');

    openSpy.mockRestore();
    await editor.destroy();
  });

  it('点击 title 不应打开链接', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const editor = await createEditor({ root: container });
    await wait(0);
    const schema = editor.getView().state.schema;
    const linkMark = schema.marks.link!.create({ href: 'https://example.com' });
    const linkParagraph = schema.nodes.paragraph!.create(null, schema.text('Example', [linkMark]));

    const view = new LinkPreviewView(linkParagraph, editor.getView(), () => 1);
    view.contentDOM.click();
    expect(openSpy).not.toHaveBeenCalled();

    openSpy.mockRestore();
    await editor.destroy();
  });

  it('ignoreMutation 普通段落返回 false', async () => {
    const editor = await createEditor({ root: container });
    await wait(0);
    const schema = editor.getView().state.schema;
    const normalParagraph = schema.nodes.paragraph!.create(null, schema.text('hello'));
    const view = new LinkPreviewView(normalParagraph, editor.getView(), () => 1);
    expect(view.ignoreMutation(mutation(view.contentDOM))).toBe(false);
    await editor.destroy();
  });
});
