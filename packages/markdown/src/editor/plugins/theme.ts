import { EditorViewReady, rootDOMCtx } from '@milkdown/core';
import type { MilkdownPlugin } from '@milkdown/ctx';
import { lightTheme, darkTheme } from '@collaflow/design';

import type { ThemeConfig } from '../../types';
import { injectNotionStyle, injectCollabCursorStyle } from '../../styles/notion-style';

type ThemeColors = typeof lightTheme.colors;

/**
 * 把 @collaflow/design 的主题色展开成 CSS 变量。
 *
 * 变量名与 design 包的 `css/variables.css`（`--cf-*`）保持一致，
 * 这样即使接入方没有引入 design 的 CSS 文件，编辑器也能拿到完整配色。
 */
export function buildThemeVariables(colors: ThemeColors): string {
  return [
    `--cf-bg-primary: ${colors.background.primary};`,
    `--cf-bg-secondary: ${colors.background.secondary};`,
    `--cf-bg-tertiary: ${colors.background.tertiary};`,
    `--cf-text-primary: ${colors.text.primary};`,
    `--cf-text-secondary: ${colors.text.secondary};`,
    `--cf-text-disabled: ${colors.text.disabled};`,
    `--cf-border-default: ${colors.border.default};`,
    `--cf-border-strong: ${colors.border.strong};`,
    `--cf-accent-blue: ${colors.accent.blue};`,
    `--cf-accent-green: ${colors.accent.green};`,
    `--cf-accent-orange: ${colors.accent.orange};`,
    `--cf-accent-red: ${colors.accent.red};`,
    `--colla-md-selection: color-mix(in srgb, ${colors.accent.blue} 15%, transparent);`,
  ].join('\n');
}

/**
 * 创建主题插件：为编辑器根节点注入主题类名与 CSS 变量。
 */
export function createThemePlugin(theme: ThemeConfig = 'light'): MilkdownPlugin {
  return (ctx) => async () => {
    await ctx.wait(EditorViewReady);

    const root = ctx.get(rootDOMCtx);
    const colors = theme === 'dark' ? darkTheme.colors : lightTheme.colors;

    root.classList.add('colla-md', `colla-md--${theme}`);
    root.dataset.theme = theme;
    root.style.cssText += buildThemeVariables(colors);

    injectNotionStyle();
    injectCollabCursorStyle();
  };
}
