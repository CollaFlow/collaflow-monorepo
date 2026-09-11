// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Packer } from 'docx';

import { buildDocxDocument } from '../src/index';
import { createEditor } from '../src/index';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('@collaflow/markdown/export-docx', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('应把常见节点构建为有效的 .docx（zip 结构）', async () => {
    const markdown = `# 标题一

这是一段含 **加粗**、*斜体* 与 [链接](https://example.com) 的正文。

- 项目一
- 项目二

| 列 A | 列 B |
| --- | --- |
| 1 | 2 |

\`\`\`js
const a = 1;
\`\`\`
`;

    const editor = await createEditor({ root: container, defaultValue: markdown });
    await wait(10);

    const doc = await buildDocxDocument(editor, { title: '测试文档' });
    const buf = await Packer.toBuffer(doc);

    expect(Buffer.isBuffer(buf)).toBe(true);
    // docx 是 zip，文件头为 PK
    expect(buf.toString('utf8', 0, 2)).toBe('PK');
    expect(buf.length).toBeGreaterThan(500);

    await editor.destroy();
  });

  it('含数学公式与图片时应回退为文本/外链而不抛错', async () => {
    const markdown = `行内公式 $E = mc^2$ 与块级公式：

$$
\\int_0^1 x^2 dx
$$

![示例图](https://example.com/nonexistent.png)
`;
    const editor = await createEditor({ root: container, defaultValue: markdown });
    await wait(10);

    const doc = await buildDocxDocument(editor, { title: '含数学的文档' });
    const buf = await Packer.toBuffer(doc);

    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.toString('utf8', 0, 2)).toBe('PK');
    expect(buf.length).toBeGreaterThan(500);

    await editor.destroy();
  });
});
