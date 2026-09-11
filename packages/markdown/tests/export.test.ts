import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildStandaloneHtml,
  collectExportCss,
  exportHtml,
  exportPdf,
} from '../src/index';

describe('@collaflow/markdown/export', () => {
  let styleContainer: HTMLElement;

  beforeEach(() => {
    styleContainer = document.createElement('div');
    document.body.appendChild(styleContainer);
  });

  afterEach(() => {
    styleContainer.remove();
  });

  function addStyle(id: string, text: string): void {
    const s = document.createElement('style');
    if (id) s.id = id;
    s.textContent = text;
    styleContainer.appendChild(s);
    document.head.appendChild(s);
  }

  it('buildStandaloneHtml 应封装为自包含文档', () => {
    const html = buildStandaloneHtml({
      title: '我的文档 & <草稿>',
      bodyHtml: '<div class="colla-md">hi</div>',
      css: '.colla-md{color:red}',
    });
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<title>我的文档 &amp; &lt;草稿&gt;</title>');
    expect(html).toContain('<style>\n.colla-md{color:red}\n</style>');
    expect(html).toContain('<div class="colla-md">hi</div>');
  });

  it('buildStandaloneHtml 默认值应可用', () => {
    const html = buildStandaloneHtml({ bodyHtml: '<p>x</p>' });
    expect(html).toContain('<title>Document</title>');
    expect(html).toContain('<p>x</p>');
  });

  it('collectExportCss 只收集 colla-md / katex 相关样式', () => {
    addStyle('colla-md-editor-style', '.colla-md{font-size:16px}');
    addStyle('', '.katex{font:1em}');
    addStyle('unrelated-app-style', '.some-app-class{color:blue}');

    const css = collectExportCss();
    expect(css).toContain('.colla-md{font-size:16px}');
    expect(css).toContain('.katex{font:1em}');
    expect(css).not.toContain('.some-app-class');
  });

  it('exportHtml 应触发下载（文件名经清理）', () => {
    const clicks: string[] = [];
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    // jsdom 未实现 createObjectURL，打桩
    (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = () =>
      'blob:mock';
    (URL as unknown as { revokeObjectURL: (s: string) => void }).revokeObjectURL = () => {};
    const clickSpy = vi.fn(function (this: HTMLAnchorElement) {
      clicks.push(this.download);
    });
    Object.defineProperty(HTMLAnchorElement.prototype, 'click', { value: clickSpy, configurable: true });

    exportHtml({ title: '报告 / 终稿', bodyHtml: '<p>x</p>', css: '' });

    expect(clicks).toEqual(['报告_终稿.html']);

    (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = origCreate;
    (URL as unknown as { revokeObjectURL: (s: string) => void }).revokeObjectURL = origRevoke;
  });

  it('exportPdf 在弹窗被拦截时安全返回 false', () => {
    const origOpen = window.open;
    (window as unknown as { open: () => null }).open = () => null;
    expect(exportPdf({ bodyHtml: '<p>x</p>' })).toBe(false);
    (window as unknown as { open: typeof origOpen }).open = origOpen;
  });
});
