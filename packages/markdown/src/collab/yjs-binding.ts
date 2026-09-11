import * as Y from 'yjs';
import type { MilkdownPlugin } from '@milkdown/ctx';
import { InitReady, editorCtx } from '@milkdown/core';
import { listenerCtx } from '@milkdown/plugin-listener';
import { replaceAll } from '@milkdown/utils';

import { parseFrontMatter, stringifyFrontMatter } from '../utils/front-matter';

/** Milkdown 编辑回写 Y.Text 时使用的 transaction origin。 */
export const YJS_ORIGIN_MILKDOWN = 'colla-md:milkdown';
/** 源码区（textarea）编辑写入 Y.Text 时使用的 transaction origin。 */
export const YJS_ORIGIN_TEXTAREA = 'colla-md:textarea';

/**
 * 计算最小差异并将 newText 应用到 yText（字符级增删）。
 *
 * 不采用整体「删除全部 + 重新插入」，否则会与并发的远端编辑冲突（整体替换会清掉他人刚插入的内容）。
 * 通过 transaction origin 标记来源，便于观察者区分「自己写的」与「远端 / 其他端写的」。
 */
export function diffApply(yText: Y.Text, newText: string, origin: unknown): void {
  const oldText = yText.toString();
  if (oldText === newText) return;

  // 最长公共前缀
  let start = 0;
  const minLen = Math.min(oldText.length, newText.length);
  while (start < minLen && oldText[start] === newText[start]) start++;

  // 最长公共后缀
  let endOld = oldText.length;
  let endNew = newText.length;
  while (endOld > start && endNew > start && oldText[endOld - 1] === newText[endNew - 1]) {
    endOld--;
    endNew--;
  }

  const deleteLength = endOld - start;
  const insertText = newText.slice(start, endNew);

  const ydoc = yText.doc;
  if (!ydoc) return;
  ydoc.transact(() => {
    if (deleteLength > 0) yText.delete(start, deleteLength);
    if (insertText) yText.insert(start, insertText);
  }, origin);
}

/**
 * 创建「Y.Text ↔ Milkdown」双向绑定插件。
 *
 * 设计前提：**Markdown 文本（Y.Text）是唯一真相**。
 * - Y.Text 变化（远端协同 / 源码区编辑）→ 重新渲染 Milkdown 预览；
 * - Milkdown 编辑 → 序列化 Markdown 写回 Y.Text（哪怕只改了预览区，也优先落到源码）。
 *
 * 借助 transaction origin 防止回环：Milkdown 自身写回的内容（origin = MILKDOWN）不会再次被应用回 Milkdown。
 */
/**
 * 去掉序列化时行首 `#` 被加上的转义反斜杠。
 *
 * remark-stringify 出于安全会把「行首的 #」写成 `\#`（否则会被当成标题）。
 * 但需求是「# 就是 #」：行首的 # 作为字面量，标题仍由「# 」（带空格）这种合法语法产生。
 * 这里只处理行首的 `\#`，不动 `>` / `*` 等其它转义，影响面最小。
 */
export function unescapeLeadingHash(markdown: string): string {
  return markdown.replace(/^\\#/gm, '#');
}

export function createCollabPlugins(content: Y.Text): MilkdownPlugin {
  return (ctx) => async () => {
    await ctx.wait(InitReady);
    const editor = ctx.get(editorCtx);

    // Y.Text -> Milkdown：仅渲染「正文」部分，Front Matter 交给属性面板展示，
    // 避免 `---` 在 WYSIWYG 中被渲染成 `<hr>` / 乱码。
    content.observe((_, transaction) => {
      if (transaction.origin === YJS_ORIGIN_MILKDOWN) return;
      const { body } = parseFrontMatter(content.toString());
      void editor.action(replaceAll(body));
    });

    // Milkdown -> Y.Text：把 Front Matter 重新拼回真相（content 此时仍含旧 FM），
    // 保证源码区 / 协同伙伴始终拿到完整文档。
    ctx.get(listenerCtx).markdownUpdated((_, markdown) => {
      const fm = parseFrontMatter(content.toString());
      const full = fm.hasFrontMatter
        ? stringifyFrontMatter(fm.data, unescapeLeadingHash(markdown))
        : unescapeLeadingHash(markdown);
      diffApply(content, full, YJS_ORIGIN_MILKDOWN);
    });
  };
}
