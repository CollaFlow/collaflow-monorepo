export { createEditor } from './editor';
export {
  CollaFlowProvider,
  createCollabPlugins,
  diffApply,
  YJS_ORIGIN_MILKDOWN,
  YJS_ORIGIN_TEXTAREA,
  decodeSelection,
  decodeOffset,
  encodeRelativePosition,
  type EncodedSelection,
  type RemoteCursor,
} from './collab';
export {
  buildDomTextCounts,
  markdownOffsetToDomTextOffset,
} from './editor/plugins/cursor-map';
export { buildToc } from './utils/toc';
export type { TocItem } from './utils/toc';
export { parseFrontMatter, stringifyFrontMatter } from './utils/front-matter';
export type { FrontMatterResult } from './utils/front-matter';
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
