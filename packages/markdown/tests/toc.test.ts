import { describe, expect, it } from 'vitest';
import { buildToc, stripInlineMarkdown } from '../src/utils/toc';

describe('@collaflow/markdown/toc', () => {
  it('buildToc 应提取各级标题', () => {
    const md = '# A\n## B\n### C\n#### D\n##### E\n###### F';
    const toc = buildToc(md);
    expect(toc).toHaveLength(6);
    expect(toc.map((i) => [i.level, i.title])).toEqual([
      [1, 'A'],
      [2, 'B'],
      [3, 'C'],
      [4, 'D'],
      [5, 'E'],
      [6, 'F'],
    ]);
  });

  it('buildToc 应去除行内标记并保留链接文本', () => {
    const md = '# `code` **bold** *italic* ~~del~~ [link](https://example.com)';
    const toc = buildToc(md);
    expect(toc).toHaveLength(1);
    expect(toc[0]?.title).toBe('code bold italic del link');
  });

  it('buildToc 应忽略代码块内的伪标题', () => {
    const md = '```\n# not-a-heading\n```\n# Real';
    const toc = buildToc(md);
    expect(toc.some((i) => i.title === 'not-a-heading')).toBe(false);
    expect(toc.some((i) => i.title === 'Real')).toBe(true);
  });

  it('buildToc 应忽略围栏代码块内多个伪标题', () => {
    const md = '# A\n```js\n# fake1\nconst x = 1;\n# fake2\n```\n## B';
    const toc = buildToc(md);
    expect(toc.map((i) => i.title)).toEqual(['A', 'B']);
  });

  it('buildToc 应正确返回每个标题的字符偏移', () => {
    const md = '# A\n\ntext\n## B';
    const toc = buildToc(md);
    expect(toc[0]?.offset).toBe(0);
    // "# A\n\ntext\n" 长度 = 6 + 1 + 1 + 5 = ... 精确校验起始下标
    expect(toc[1]?.offset).toBe('# A\n\ntext\n'.length);
  });

  it('buildToc 空字符串返回空数组', () => {
    expect(buildToc('')).toEqual([]);
  });

  it('stripInlineMarkdown 应处理嵌套与未匹配标记', () => {
    expect(stripInlineMarkdown('`**a**`')).toBe('a');
    expect(stripInlineMarkdown('unmatched * marker')).toBe('unmatched * marker');
    expect(stripInlineMarkdown('<span>text</span>')).toBe('text');
  });
});
