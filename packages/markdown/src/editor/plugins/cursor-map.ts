import type { Node as PMNode } from 'prosemirror-model';

/**
 * 预览区（Milkdown / ProseMirror）是富文本，而协同真相是 Y.Text（Markdown 纯文本）。
 * 远端光标要落进预览区，需要知道「Markdown 第 o 个字符」在渲染后的 DOM 里对应第几个「真实文本字符」。
 *
 * 本函数同步遍历 ProseMirror 文档与 Markdown 字符串，统计每个 Markdown 下标之前有多少字符是
 * 「真实 DOM 文本」（即去掉 `#`/`*`/反引号/换行等语法字符后的内容）。返回的数组长度为
 * markdown.length + 1，counts[i] = markdown[0..i) 中的真实文本字符数。
 *
 * 配合在预览容器里按「真实文本字符偏移」定位 DOM 节点，即可用 getBoundingClientRect 算出远端光标坐标，
 * 无需把 Markdown 偏移映射到 ProseMirror 坐标（那需要解析序列化格式，更脆弱）。
 *
 * 注：覆盖 commonmark 常见节点；自定义布局节点（Callout/Columns 等）按纯文本近似处理，光标可能略有偏差。
 */
export function buildDomTextCounts(doc: PMNode, markdown: string): number[] {
  const counts = new Array<number>(markdown.length + 1).fill(0);
  let md = 0;
  let count = 0;

  const text = (n: number) => {
    for (let i = 0; i < n && md < markdown.length; i++) {
      counts[md] = count;
      md++;
      count++;
    }
    if (md <= markdown.length) counts[md] = count;
  };

  const syntax = (n: number) => {
    for (let i = 0; i < n && md < markdown.length; i++) {
      counts[md] = count;
      md++;
    }
    if (md <= markdown.length) counts[md] = count;
  };

  const inline = (node: PMNode) => {
    node.forEach((child) => {
      if (child.isText) {
        const marks = child.marks.map((m) => m.type.name);
        const str = child.text as string;
        // Milkdown 的 mark 名为 inlineCode / emphasis（兼容通用名 code / em）
        if (marks.includes('inlineCode') || marks.includes('code')) {
          syntax(1);
          text(str.length);
          syntax(1);
        } else {
          if (marks.includes('strong')) syntax(2);
          if (marks.includes('emphasis') || marks.includes('em')) syntax(1);
          text(str.length);
          if (marks.includes('emphasis') || marks.includes('em')) syntax(1);
          if (marks.includes('strong')) syntax(2);
        }
      } else if (child.type.name === 'hardbreak' || child.type.name === 'hard_break') {
        syntax(1);
      } else {
        text(child.textContent.length);
      }
    });
  };

  const fence = (node: PMNode) => {
    const lang = (node.attrs.language as string) ?? '';
    syntax(3);
    syntax(lang.length);
    syntax(1);
    text(node.textContent.length);
    syntax(1);
    syntax(3);
  };

  const walk = (node: PMNode) => {
    switch (node.type.name) {
      case 'doc':
        node.forEach(walk);
        return;
      case 'paragraph':
        inline(node);
        syntax(2);
        return;
      case 'heading':
        syntax((node.attrs.level as number) + 1);
        inline(node);
        syntax(2);
        return;
      case 'blockquote':
        syntax(2);
        inline(node);
        syntax(2);
        return;
      case 'code_block':
        fence(node);
        syntax(2);
        return;
      case 'bullet_list':
        node.forEach((li) => {
          syntax(2);
          walk(li);
        });
        syntax(2);
        return;
      case 'ordered_list':
        node.forEach((li, i) => {
          syntax(String(i + 1).length + 2);
          walk(li);
        });
        syntax(2);
        return;
      case 'list_item':
        node.forEach(walk);
        return;
      default:
        // 自定义 / 未知节点：按纯文本近似，并补一个块分隔
        text(node.textContent.length);
        syntax(2);
        return;
    }
  };

  walk(doc);

  // 收敛：剩余未消费的 markdown 当作语法字符
  syntax(markdown.length - md);

  return counts;
}

/**
 * 将 Y.Text 偏移转换为「真实 DOM 文本偏移」。
 */
export function markdownOffsetToDomTextOffset(
  counts: number[],
  offset: number
): number {
  const clamped = Math.max(0, Math.min(offset, counts.length - 1));
  return counts[clamped] as number;
}
