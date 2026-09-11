import { describe, expect, it } from 'vitest';

import { createEditor } from '../src/index';
import { parseFrontMatter, stringifyFrontMatter } from '../src/utils/front-matter';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('@collaflow/markdown/front-matter', () => {
  it('应识别含闭合围栏的 Front Matter 并分离正文', () => {
    const md = '---\ntitle: Hello\n---\n# Heading\n\nbody text';
    const result = parseFrontMatter(md);
    expect(result.hasFrontMatter).toBe(true);
    expect(result.data).toEqual({ title: 'Hello' });
    expect(result.body).toBe('# Heading\n\nbody text');
  });

  it('应解析标量类型（字符串/数字/布尔/null）', () => {
    const md = [
      '---',
      'title: My Note',
      'draft: false',
      'views: 42',
      'empty:',
      'note: ~',
      '---',
      'body',
    ].join('\n');
    const { data } = parseFrontMatter(md);
    expect(data).toEqual({
      title: 'My Note',
      draft: false,
      views: 42,
      empty: null,
      note: null,
    });
  });

  it('应解析内联数组与块数组', () => {
    const inline = '---\ntags: [a, b, c]\n---\nbody';
    expect(parseFrontMatter(inline).data).toEqual({ tags: ['a', 'b', 'c'] });

    const block = '---\ntags:\n  - x\n  - y\n---\nbody';
    expect(parseFrontMatter(block).data).toEqual({ tags: ['x', 'y'] });
  });

  it('应解析引号字符串中的特殊字符', () => {
    const md = '---\ntitle: "a: b # c"\n---\nbody';
    expect(parseFrontMatter(md).data).toEqual({ title: 'a: b # c' });
  });

  it('无 Front Matter 时应原样返回正文', () => {
    const md = '# Just a heading\n\ntext';
    const result = parseFrontMatter(md);
    expect(result.hasFrontMatter).toBe(false);
    expect(result.body).toBe(md);
    expect(result.data).toEqual({});
  });

  it('仅开头 `---` 而无闭合时应视为普通正文（不丢内容）', () => {
    const md = '---\nnot front matter\n\n# Real';
    const result = parseFrontMatter(md);
    expect(result.hasFrontMatter).toBe(false);
    expect(result.body).toBe(md);
  });

  it('串行化后再解析应保持一致（round-trip）', () => {
    const data = { title: 'Hello', draft: false, views: 3, tags: ['a', 'b'] };
    const out = stringifyFrontMatter(data, '# Body');
    expect(parseFrontMatter(out).data).toEqual(data);
    expect(parseFrontMatter(out).body).toBe('# Body');
  });

  it('方括号等特殊值应被引号包裹后再序列化', () => {
    const out = stringifyFrontMatter({ title: 'a: b' }, '');
    expect(out).toContain('title: "a: b"');
  });

  describe('integration (编辑器 round-trip)', () => {
    it('加载时应将 Front Matter 保留在 Y.Text 真相中，但 WYSIWYG 仅渲染正文', async () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      const editor = await createEditor({
        root: container,
        defaultValue: '---\ntitle: Hi\n---\n# Body',
      });
      await wait(0);

      // 真相保留完整文档（含 FM）
      expect(editor.content.toString()).toContain('title: Hi');
      // WYSIWYG 只渲染正文：getMarkdown 不含 FM，且含正文标题
      expect(editor.getMarkdown()).not.toContain('title: Hi');
      expect(editor.getMarkdown()).toContain('# Body');

      await editor.destroy();
      container.remove();
    });

    it('setMarkdown 应能写入 / 去除 Front Matter', async () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      const editor = await createEditor({ root: container, defaultValue: '# hi' });
      await wait(0);

      await editor.setMarkdown('---\nauthor: X\n---\n# New body');
      await wait(0);
      expect(editor.content.toString()).toContain('author: X');
      expect(editor.getMarkdown()).toContain('# New body');

      await editor.setMarkdown('# Just body');
      await wait(0);
      expect(editor.content.toString()).not.toContain('author: X');
      expect(editor.getMarkdown()).toContain('# Just body');

      await editor.destroy();
      container.remove();
    });
  });
});
