/**
 * 文档导出工具：把编辑器渲染后的 HTML 封装为独立文件。
 *
 * 设计要点：
 * - 引擎只负责「把渲染好的 HTML + 样式拼成独立文档」与「触发下载/打印」，
 *   渲染本身由 Milkdown 完成（调用方传入 `editor.getHtml()` 的结果）。
 * - 源码仍是源码：`getHtml()` 取的是预览区 DOM，不影响 Y.Text 真相。
 * - PDF 走浏览器「打印 → 另存为 PDF」路径（无需后端、矢量、与屏幕一致）。
 */

/**
 * 构建独立 HTML 文档所需的输入。
 */
export interface StandaloneHtmlOptions {
  /** 已渲染的正文 HTML（建议为 `.colla-md` 容器 outerHTML，自带内联主题变量） */
  bodyHtml: string;
  /** 文档标题（用于 `<title>` 与默认文件名） */
  title?: string;
  /** 需内联的样式表文本（Notion + KaTeX 等），由 `collectExportCss()` 收集 */
  css?: string;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sanitizeFilename(input: string): string {
  return (
    input
      .trim()
      .replace(/[\\/:*?"<>|]+/g, '') // 移除非法字符
      .replace(/\s+/g, '_') // 空白 → 单个下划线
      .replace(/_+/g, '_') // 合并连续下划线
      .replace(/^_|_$/g, '') // 去掉首尾下划线
      .slice(0, 80) || 'document'
  );
}

/**
 * 把渲染后的正文与样式封装为一份自包含、可直接用浏览器打开的 HTML 文档字符串。
 * 纯函数，不依赖 DOM，便于测试。
 */
export function buildStandaloneHtml(opts: StandaloneHtmlOptions): string {
  const { bodyHtml, title = 'Document', css = '' } = opts;
  const safeTitle = escapeHtml(title);
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${safeTitle}</title>
<style>
${css}
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

/**
 * 从当前文档中收集导出所需的样式：所有 `colla-md` 相关样式表，以及包含 KaTeX
 * 规则的样式表（katex CSS 由 esbuild 在运行时匿名注入，没有固定 id）。
 * 返回拼接后的 CSS 文本；非浏览器环境返回空串。
 */
export function collectExportCss(): string {
  if (typeof document === 'undefined') return '';
  const styles = Array.from(document.querySelectorAll('style')) as HTMLStyleElement[];
  return styles
    .filter((s) => {
      const id = s.id || '';
      const text = s.textContent || '';
      return id.startsWith('colla-md') || text.includes('.katex') || text.includes('.colla-');
    })
    .map((s) => s.textContent || '')
    .join('\n');
}

/**
 * 触发浏览器下载一段文本内容。
 */
export function downloadFile(content: string, filename: string, mime = 'text/html'): void {
  if (typeof document === 'undefined') return;
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * 导出为独立 HTML 文件并触发下载。
 */
export function exportHtml(opts: StandaloneHtmlOptions & { filename?: string }): void {
  const html = buildStandaloneHtml(opts);
  downloadFile(html, `${sanitizeFilename(opts.filename ?? opts.title ?? 'document')}.html`);
}

/**
 * 导出为 PDF：生成独立 HTML 并在新窗口中唤起浏览器打印（用户可「另存为 PDF」）。
 * 复用屏幕渲染结果，矢量、与预览一致；mermaid/KaTeX 已内联，无需后端。
 */
export function exportPdf(opts: StandaloneHtmlOptions & { filename?: string }): boolean {
  if (typeof window === 'undefined') return false;
  const html = buildStandaloneHtml(opts);
  const w = window.open('', '_blank');
  if (!w) return false; // 弹窗被拦截
  w.document.open();
  w.document.write(html);
  w.document.close();
  // 等样式/字体就绪后再打印（内联资源通常已同步可用，给一帧兜底）
  w.onload = () => {
    w.focus();
    w.print();
  };
  setTimeout(() => {
    try {
      w.focus();
      w.print();
    } catch {
      /* 弹窗已关闭等情况，忽略 */
    }
  }, 350);
  return true;
}
