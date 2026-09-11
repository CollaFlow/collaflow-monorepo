# API 参考：公共接口

> 本文件是 `collamarkdown-tech-spec` 的深入内容。接口以 `packages/markdown/src/types/index.ts` 与 `collab/` 为准。

## 1. 编辑器配置与实例

```ts
export interface AwarenessUserInfo {
  name: string;
  color: string;       // HEX
  avatar?: string;
}

export interface AwarenessUserState {
  clientId: number;
  user: AwarenessUserInfo;
}

export interface CollabOptions {
  roomId: string;      // Hocuspocus 文档名
  serverUrl: string;   // 如 ws://localhost:1234
  user?: AwarenessUserInfo;
}

export interface CollaMarkdownEditorOptions {
  root: HTMLElement;
  defaultValue?: string;
  collab?: CollabOptions;
  highlight?: boolean | { type: 'prism' | 'shiki' };
  theme?: 'light' | 'dark';
  plugins?: MilkdownPlugin[];
  onChange?: (markdown: string) => void;
  onAwarenessChange?: (users: AwarenessUserState[]) => void;
}

export interface CollaMarkdownEditor {
  readonly editor: Editor;
  readonly content: Y.Text;                       // 协同唯一真相
  getView(): EditorView;                          // 底层 ProseMirror 视图
  getMarkdown(): string;                          // 已 unescapeLeadingHash
  getHtml(): string;                              // 预览 DOM 的 outerHTML（用于导出）
  setMarkdown(value: string): Promise<void>;
  getAwarenessUsers(): AwarenessUserState[];
  setLocalSelection(anchor: number, head: number): void;  // Y.Text 字符偏移
  getRemoteCursors(): RemoteCursor[];             // 已解码为 Y.Text 绝对偏移
  destroy(): Promise<void>;
}
```

入口：`createEditor(options): Promise<CollaMarkdownEditor>`（来自 `src/editor`）。

> `createEditor` 在 `collab` 配置存在时会**自动** `provider.connect()`，无需调用方手动连接。

## 2. 协同 Provider（CollaFlowProvider）

来自 `collab/provider.ts`：

```ts
class CollaFlowProvider {
  readonly doc: Y.Doc;
  readonly awareness: awarenessProtocol.Awareness;
  get isConnected(): boolean;
  get content(): Y.Text;                          // doc.getText('content')
  getAwarenessUsers(): AwarenessUserState[];      // 过滤带 name+color 的客户端
  connect(): void;
  disconnect(): void;                             // 保留本地 doc
  destroy(): void;
  setLocalSelection(anchor: number, head: number): void;  // 编码为相对位置写入 awareness
  getRemoteCursors(): RemoteCursor[];             // 解码为 Y.Text 绝对偏移
}
```

## 3. 光标相对位置工具

来自 `collab/cursor.ts`（也经 `collab/index.ts` 再导出）：

```ts
export interface EncodedSelection { anchor: string; head: string }  // base64 相对位置
export interface RemoteCursor {
  clientId: number;
  user: AwarenessUserInfo;
  anchor: number;   // Y.Text 绝对偏移
  head: number;     // Y.Text 绝对偏移
}

encodeRelativePosition(yText: Y.Text, index: number): string;   // → base64
decodeOffset(yText: Y.Text, encoded: string): number | null;    // 位置被删 → null
decodeSelection(yText: Y.Text, sel: EncodedSelection): { anchor: number; head: number } | null;
```

## 4. 包对外导出（src/index.ts）

```ts
export { createEditor } from './editor';

export {
  CollaFlowProvider,
  createCollabPlugins,
  diffApply,
  unescapeLeadingHash,
  YJS_ORIGIN_MILKDOWN,
  YJS_ORIGIN_TEXTAREA,
  decodeSelection,
  decodeOffset,
  encodeRelativePosition,
  type EncodedSelection,
  type RemoteCursor,
} from './collab';

export { buildDomTextCounts, markdownOffsetToDomTextOffset } from './editor/plugins/cursor-map';

// 目录大纲 / Front Matter
export { buildToc } from './utils/toc';
export type { TocItem } from './utils/toc';
export { parseFrontMatter, stringifyFrontMatter } from './utils/front-matter';
export type { FrontMatterResult } from './utils/front-matter';

// 导出 HTML / PDF / Word
export {
  buildStandaloneHtml,
  collectExportCss,
  downloadFile,
  exportHtml,
  exportPdf,
} from './utils/export';
export type { StandaloneHtmlOptions } from './utils/export';
export { buildDocxDocument, exportDocx } from './utils/export-docx';
export type { DocxExportOptions } from './utils/export-docx';

// 链接预览插件
export { createLinkPreviewPlugin } from './editor/plugins/link-preview';
export type { LinkPreviewData, LinkPreviewResolver } from './editor/plugins/link-preview';

export type {
  AwarenessUserInfo,
  CollabOptions,
  HighlightOptions,
  ThemeConfig,
  CollaMarkdownEditorOptions,
  CollaMarkdownEditor,
} from './types';
```

## 5. 插件集合（editor/plugins/index.ts）

```ts
export { collaCursorBuilder, collaSelectionBuilder, createAwarenessPlugin } from './awareness';
export { configureHighlightLanguages, createHighlightPlugin, refractor, prism, prismConfig } from './highlight';
export { calloutNode, columnsNode, columnNode, cardNode, layoutNodes } from './layout';
export { createThemePlugin } from './theme';
export { taskListTogglePlugin } from './task-list';
export { createSlashCommandPlugin } from './slash-command';
export { imageCardPlugin } from './image-card';
export { createLinkPreviewPlugin } from './link-preview';
export type { LinkPreviewData, LinkPreviewResolver } from './link-preview';
export { blockHandlePlugin, createBlockHandleElement, buildConversionItems } from './block-handle';
export type { BlockConversionItem } from './block-handle';
export { createMermaidPlugin } from './mermaid';
export type { MermaidRenderFn } from './mermaid';
```

> 数学公式通过 `@milkdown/plugin-math` 在 `factory.ts` 中以 `.use(math)` 接入（非独立插件文件），并 `import 'katex/dist/katex.min.css'`。

## 6. 关键实现文件

| 文件 | 职责 |
|---|---|
| `src/editor/factory.ts` | `createEditor` 工厂：构建插件、绑定 `Y.Text`、接入 math/mermaid、`getView`/`getHtml` |
| `src/editor/options.ts` | 配置合并与默认值（`resolveEditorOptions` / `DEFAULT_EDITOR_OPTIONS`） |
| `src/collab/provider.ts` | `CollaFlowProvider`：Hocuspocus 客户端，`content: Y.Text` |
| `src/collab/yjs-binding.ts` | `Y.Text ↔ Milkdown` 绑定、`diffApply`、origin 常量 |
| `src/collab/cursor.ts` | 相对位置编解码（encode / decode / base64） |
| `src/editor/plugins/cursor-map.ts` | 预览区光标映射（`buildDomTextCounts` 等） |
| `src/editor/plugins/awareness.ts` | 远端光标 / 选区渲染（`yCursorPlugin` 封装） |
| `src/editor/plugins/mermaid.ts` | Mermaid 代码块 → SVG |
| `src/editor/plugins/image-card.ts` | 图片卡节点（`imageCardPlugin`） |
| `src/editor/plugins/link-preview.ts` | 链接预览（`createLinkPreviewPlugin` + `LinkPreviewResolver`） |
| `src/editor/plugins/slash-command.ts` | 斜杠命令菜单 |
| `src/editor/plugins/block-handle.ts` | 左侧块把手 / 块类型转换 |
| `src/utils/toc.ts` | 目录大纲抽取（`buildToc` / `TocItem`） |
| `src/utils/front-matter.ts` | Front Matter 解析 / 序列化 |
| `src/utils/export.ts` | 导出 HTML / PDF（自包含 HTML + 浏览器打印） |
| `src/utils/export-docx.ts` | 导出 Word（`buildDocxDocument` / `exportDocx`，docx v9） |
| `src/styles/notion-style.ts` | 预览区 / 源码区 Notion 风格样式 |
