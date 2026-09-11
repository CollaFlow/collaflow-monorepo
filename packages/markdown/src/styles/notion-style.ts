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

/* ===== 图片卡片 ===== */
.colla-image-card {
  display: inline-block;
  max-width: 100%;
  border: 1px solid var(--cf-border-default);
  border-radius: 6px;
  overflow: hidden;
  background: var(--cf-bg-secondary);
  margin: 4px 0;
}
.colla-image-card--selected {
  outline: 2px solid var(--cf-accent-blue);
  outline-offset: 2px;
}
.colla-image-card img {
  display: block;
  max-width: 100%;
}
.colla-image-card__caption {
  padding: 6px 10px;
  font-size: 0.85em;
  color: var(--cf-text-secondary);
  border-top: 1px solid var(--cf-border-default);
}

/* ===== 链接卡片预览 ===== */
.colla-link-card {
  display: block;
  border: 1px solid var(--cf-border-default);
  border-radius: 6px;
  padding: 10px 12px;
  margin: 4px 0;
  background: var(--cf-bg-secondary);
  cursor: pointer;
  transition: background 0.15s ease;
}
.colla-link-card:hover {
  background: var(--cf-bg-tertiary);
}
.colla-link-card--preview .colla-link-card__title {
  display: block;
  color: var(--cf-text-primary);
  font-weight: 500;
  padding: 0;
}
.colla-link-card--preview .colla-link-card__title a {
  color: inherit;
  text-decoration: none;
}
.colla-link-card__url {
  display: block;
  font-size: 0.8em;
  color: var(--cf-text-secondary);
  margin-top: 2px;
  word-break: break-all;
}
.colla-link-card__meta {
  display: block;
  font-size: 0.8em;
  color: var(--cf-text-secondary);
  margin-top: 4px;
}

/* ===== GFM 扩展：Notion 风格样式 ===== */

/* 删除线 */
.colla-md s,
.colla-md del,
.colla-md strike {
  text-decoration: line-through;
  color: var(--cf-text-secondary);
}

/* 表格 */
.colla-md table {
  width: 100%;
  border-collapse: collapse;
  margin: 4px 0;
  font-size: 0.95em;
}
.colla-md thead,
.colla-md tr[data-is-header="true"] {
  border-top: 1px solid var(--cf-border-default);
  border-bottom: 1px solid var(--cf-border-default);
}
.colla-md th {
  background: var(--cf-bg-tertiary);
  font-weight: 600;
  text-align: left;
  padding: 8px 12px;
  color: var(--cf-text-primary);
}
.colla-md td {
  padding: 8px 12px;
  border-bottom: 1px solid var(--cf-border-default);
}
.colla-md tbody tr:last-child td {
  border-bottom: 1px solid var(--cf-border-default);
}

/* 任务列表 */
.colla-md li[data-item-type="task"] {
  list-style: none;
  position: relative;
  padding-left: 1.6em;
}
.colla-md li[data-item-type="task"]::before {
  content: '';
  position: absolute;
  left: -1.4em;
  top: 0.35em;
  width: 16px;
  height: 16px;
  border: 1px solid var(--cf-border-strong);
  border-radius: 3px;
  background: var(--cf-bg-secondary);
  pointer-events: auto;
  cursor: pointer;
}
.colla-md li[data-item-type="task"][data-checked="true"]::before {
  background: var(--cf-accent-blue);
  border-color: var(--cf-accent-blue);
}
.colla-md li[data-item-type="task"][data-checked="true"]::after {
  content: '';
  position: absolute;
  left: calc(-1.4em + 4px);
  top: calc(0.35em + 1px);
  width: 5px;
  height: 9px;
  border: solid var(--cf-bg-secondary);
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
  pointer-events: none;
}
.colla-md li[data-item-type="task"][data-checked="true"] {
  color: var(--cf-text-disabled);
  text-decoration: line-through;
}

/* 脚注 */
.colla-md dl[data-type="footnote_definition"] {
  margin-top: 2em;
  padding-top: 1em;
  border-top: 1px solid var(--cf-border-default);
  font-size: 0.85em;
  color: var(--cf-text-secondary);
}
.colla-md dl[data-type="footnote_definition"] dt {
  float: left;
  margin-right: 0.5em;
  font-weight: 600;
  color: var(--cf-text-primary);
}
.colla-md dl[data-type="footnote_definition"] dd {
  margin: 0;
}
.colla-md dl[data-type="footnote_definition"] dd > p {
  padding: 0;
}
.colla-md sup[data-type="footnote_reference"] {
  font-size: 0.75em;
  color: var(--cf-accent-blue);
}

/* 自动链接与手动链接统一风格 */
.colla-md a { color: var(--cf-accent-blue); text-decoration: none; }
.colla-md a:hover { text-decoration: underline; }

/* ===== Slash 命令菜单 ===== */
.colla-slash-menu {
  background: var(--cf-bg-secondary);
  border: 1px solid var(--cf-border-default);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  min-width: 180px;
  padding: 4px;
  font-family: ${NOTION_FONT_FAMILY};
  font-size: 14px;
}
.colla-slash-menu__item {
  padding: 6px 10px;
  border-radius: 4px;
  cursor: pointer;
  color: var(--cf-text-primary);
}
.colla-slash-menu__item:hover,
.colla-slash-menu__item--selected {
  background: var(--cf-bg-tertiary);
}

/* ===== 左侧块把手（Notion 式）===== */
.colla-block-handle {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border-radius: 4px;
  cursor: grab;
  color: var(--cf-text-secondary);
  opacity: 0;
  transition: opacity 0.12s ease, background 0.12s ease;
  user-select: none;
}
.colla-block-handle[data-show='true'] {
  opacity: 1;
}
.colla-block-handle:hover {
  background: var(--cf-bg-tertiary);
}
.colla-block-handle:active {
  cursor: grabbing;
}
.colla-block-handle__add,
.colla-block-handle__drag {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 4px;
  font-size: 14px;
  line-height: 1;
}
.colla-block-handle__add {
  font-size: 16px;
}
.colla-block-handle__add:hover {
  background: var(--cf-bg-secondary);
}

/* ===== 块类型转换菜单 ===== */
.colla-block-menu {
  position: fixed;
  z-index: 1000;
  min-width: 180px;
  padding: 4px;
  border: 1px solid var(--cf-border-default);
  border-radius: 6px;
  background: var(--cf-bg-secondary);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  font-family: ${NOTION_FONT_FAMILY};
  font-size: 14px;
}
.colla-block-menu__item {
  padding: 6px 10px;
  border-radius: 4px;
  cursor: pointer;
  color: var(--cf-text-primary);
}
.colla-block-menu__item:hover {
  background: var(--cf-bg-tertiary);
}

/* ===== Mermaid 图表 ===== */
.colla-code-block--mermaid {
  margin: 4px 0;
}
.colla-mermaid {
  display: block;
  padding: 12px;
  border: 1px solid var(--cf-border-default);
  border-radius: 6px;
  background: var(--cf-bg-secondary);
  overflow: auto;
}
.colla-mermaid svg {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 0 auto;
}
.colla-mermaid--error {
  color: var(--cf-accent-red);
  font-size: 0.85em;
  white-space: pre-wrap;
}

/* ===== 数学公式（KaTeX，Notion 一致风格） ===== */
/* 行内公式：Notion 式浅灰底胶囊 */
.colla-md [data-type='math_inline'] {
  background: var(--cf-bg-tertiary);
  padding: 0.1em 0.3em;
  border-radius: 4px;
}
/* 块级公式：居中、浅底、圆角卡片，源码仍是 $$...$$ */
.colla-md [data-type='math_block'] {
  display: block;
  background: var(--cf-bg-secondary);
  border: 1px solid var(--cf-border-default);
  border-radius: 6px;
  padding: 10px 12px;
  margin: 6px 0;
  text-align: center;
  overflow-x: auto;
}
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
