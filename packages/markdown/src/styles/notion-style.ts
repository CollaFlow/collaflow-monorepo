/**
 * Notion 风格的编辑器内容样式。
 *
 * 作用于 `.colla-md`（Milkdown 根节点），颜色全部引用 design 的 `--cf-*` 变量，
 * 因此随 light / dark 主题自动切换。字体采用 Notion 的系统字体栈。
 *
 * 该样式在 `createThemePlugin` 初始化时由 `injectNotionStyle()` 注入一次，
 * 编辑器为纯客户端组件，无需 SSR 守卫。
 */

/** Notion 正文使用的系统字体栈 */
export const NOTION_FONT_FAMILY =
  'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, "Apple Color Emoji", Arial, sans-serif';

/** 等宽字体（行内代码 / 代码块） */
export const NOTION_MONO_FAMILY =
  'SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';

/** Notion 风格编辑器样式表（已按 `.colla-md` 作用域限定） */
export const NOTION_EDITOR_CSS = `
.colla-md {
  font-family: ${NOTION_FONT_FAMILY};
  font-size: 16px;
  line-height: 1.5;
  color: var(--cf-text-primary);
  font-weight: 400;
  word-break: break-word;
  -webkit-font-smoothing: antialiased;
}
.colla-md h1 { font-size: 1.875em; font-weight: 700; line-height: 1.3; margin: 1.4em 0 0.2em; }
.colla-md h2 { font-size: 1.5em; font-weight: 600; line-height: 1.3; margin: 1.2em 0 0.2em; }
.colla-md h3 { font-size: 1.25em; font-weight: 600; line-height: 1.3; margin: 1em 0 0.2em; }
.colla-md h4 { font-size: 1em; font-weight: 600; line-height: 1.3; margin: 0.8em 0 0.2em; }
.colla-md h5, .colla-md h6 { font-size: 0.875em; font-weight: 600; line-height: 1.3; margin: 0.8em 0 0.2em; }
.colla-md p { margin: 0; padding: 3px 2px; line-height: 1.5; }
.colla-md ul, .colla-md ol { margin: 0; padding-left: 1.6em; padding-top: 2px; padding-bottom: 2px; }
.colla-md li { margin: 2px 0; }
.colla-md li > p { padding: 0; }
.colla-md :not(pre) > code {
  font-family: ${NOTION_MONO_FAMILY};
  background: rgba(135, 131, 120, 0.15);
  color: var(--cf-text-primary);
  border-radius: 4px;
  padding: 0.2em 0.4em;
  font-size: 0.85em;
}
.colla-md pre {
  font-family: ${NOTION_MONO_FAMILY};
  background: var(--cf-bg-tertiary);
  color: var(--cf-text-primary);
  border-radius: 4px;
  padding: 1em 1.2em;
  margin: 4px 0;
  overflow: auto;
  font-size: 0.85em;
  line-height: 1.45;
}
.colla-md pre code { font-family: inherit; background: none; padding: 0; }
.colla-md blockquote {
  border-left: 3px solid var(--cf-border-strong);
  padding-left: 12px;
  margin: 4px 0;
  color: var(--cf-text-secondary);
}
.colla-md a { color: var(--cf-accent-blue); text-decoration: none; }
.colla-md a:hover { text-decoration: underline; }
.colla-md strong { font-weight: 600; }
.colla-md hr { border: none; border-top: 1px solid var(--cf-border-default); margin: 6px 0; }
.colla-md img { max-width: 100%; border-radius: 4px; }
`;

/**
 * 协同远端光标的叠层样式（不限定在 .colla-md 内，因为光标层是预览/源码区的兄弟节点）。
 * 具体颜色由调用方按用户色通过 inline style 设置。
 */
export const COLLAB_CURSOR_CSS = `
.colla-rc-cursor {
  position: absolute;
  width: 2px;
  pointer-events: none;
  z-index: 20;
}
.colla-rc-label {
  position: absolute;
  top: -1.25em;
  left: -1px;
  font-size: 11px;
  line-height: 1;
  padding: 2px 5px;
  border-radius: 3px 3px 3px 0;
  color: #fff;
  white-space: nowrap;
  font-family: ${NOTION_FONT_FAMILY};
  pointer-events: none;
  user-select: none;
  z-index: 21;
}
`;

const NOTION_STYLE_ID = 'colla-md-notion-style';
const COLLAB_CURSOR_STYLE_ID = 'colla-md-collab-cursor';

/**
 * 向文档注入一次 Notion 风格样式表（幂等：已存在则跳过）。
 */
export function injectNotionStyle(): void {
  if (document.getElementById(NOTION_STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = NOTION_STYLE_ID;
  style.textContent = NOTION_EDITOR_CSS;
  document.head.appendChild(style);
}

/**
 * 向文档注入一次协同光标样式表（幂等）。
 */
export function injectCollabCursorStyle(): void {
  if (document.getElementById(COLLAB_CURSOR_STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = COLLAB_CURSOR_STYLE_ID;
  style.textContent = COLLAB_CURSOR_CSS;
  document.head.appendChild(style);
}
