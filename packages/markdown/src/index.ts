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
export type {
  AwarenessUserInfo,
  CollabOptions,
  HighlightOptions,
  ThemeConfig,
  CollaMarkdownEditorOptions,
  CollaMarkdownEditor,
} from './types';
