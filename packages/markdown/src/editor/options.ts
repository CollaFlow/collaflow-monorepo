import type { CollaMarkdownEditorOptions } from '../types';

/**
 * 编辑器默认配置。
 */
export const DEFAULT_EDITOR_OPTIONS: Required<
  Pick<CollaMarkdownEditorOptions, 'defaultValue' | 'highlight' | 'theme'>
> = {
  defaultValue: '',
  highlight: true,
  theme: 'light',
};

/**
 * 合并用户配置与默认配置。
 */
export function resolveEditorOptions(
  options: CollaMarkdownEditorOptions
): Required<Omit<CollaMarkdownEditorOptions, 'collab' | 'plugins' | 'linkPreviewResolver' | 'onChange' | 'onAwarenessChange'>> &
  Pick<CollaMarkdownEditorOptions, 'collab' | 'plugins' | 'linkPreviewResolver' | 'onChange' | 'onAwarenessChange'> {
  return {
    root: options.root,
    defaultValue: options.defaultValue ?? DEFAULT_EDITOR_OPTIONS.defaultValue,
    highlight: options.highlight ?? DEFAULT_EDITOR_OPTIONS.highlight,
    theme: options.theme ?? DEFAULT_EDITOR_OPTIONS.theme,
    collab: options.collab,
    plugins: options.plugins,
    linkPreviewResolver: options.linkPreviewResolver,
    onChange: options.onChange,
    onAwarenessChange: options.onAwarenessChange,
  };
}
