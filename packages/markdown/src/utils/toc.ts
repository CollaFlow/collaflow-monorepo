/**
 * 目录项。
 */
export interface TocItem {
  /** 标题层级 1~6 */
  level: number;
  /** 纯文本标题（已去除行内 Markdown 标记） */
  title: string;
  /** 标题在 Markdown 文本中的字符偏移 */
  offset: number;
}

/**
 * 去除标题中的行内 Markdown 标记，得到用于目录展示的纯文本。
 *
 * 处理范围：
 * - 加粗 / 斜体：`*` / `_` / `**` / `__`
 * - 删除线：`~~`
 * - 行内代码：`` ` ``
 * - 链接：保留链接文本，丢弃 URL
 * - HTML 标签
 */
export function stripInlineMarkdown(title: string): string {
  return (
    title
      // 行内代码：保留内容
      .replace(/`([^`]*)`/g, '$1')
      // 删除线
      .replace(/~~(.*?)~~/g, '$1')
      // 加粗 / 斜体（匹配成对标记）
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/__(.*?)__/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/_(.*?)_/g, '$1')
      // 链接：保留文本
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      // 自动链接 <https://...> / <mailto:...>
      .replace(/<(\S+?:\/\/[^>]+)>/g, '$1')
      .replace(/<(mailto:[^>]+)>/g, '$1')
      // 剩余 HTML 标签
      .replace(/<[^>]+>/g, '')
      .trim()
  );
}

const FENCE_RE = /^```/;
const HEADING_RE = /^(#{1,6})\s+(.+)$/;

/**
 * 从 Markdown 文本中提取目录大纲。
 *
 * 仅识别 ATX 风格标题（`# Heading`），并跳过围栏代码块（```）内部的伪标题。
 * 返回值按文档顺序排列，`offset` 为标题行首 `#` 在原文中的字符偏移。
 */
export function buildToc(markdown: string): TocItem[] {
  const items: TocItem[] = [];
  const lines = markdown.split('\n');

  let offset = 0;
  let inFence = false;
  for (const line of lines) {
    if (FENCE_RE.test(line)) {
      inFence = !inFence;
    } else if (!inFence) {
      const match = HEADING_RE.exec(line);
      if (match) {
        const hashes = match[1]!;
        const rawTitle = match[2]!.trim();
        items.push({
          level: hashes.length,
          title: stripInlineMarkdown(rawTitle),
          offset,
        });
      }
    }
    // +1 还原被 split 去掉的换行符，保证 offset 与原文下标一致
    offset += line.length + 1;
  }

  return items;
}
