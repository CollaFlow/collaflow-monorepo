import { EditorViewReady, rootCtx } from '@milkdown/core';
import type { MilkdownPlugin } from '@milkdown/ctx';

import type { ThemeConfig } from '../../types';

/**
 * CollaFlow Markdown 编辑器主题 CSS 变量。
 */
const LIGHT_THEME = `
  --colla-md-bg: #ffffff;
  --colla-md-fg: #1f2937;
  --colla-md-border: #e5e7eb;
  --colla-md-code-bg: #f3f4f6;
  --colla-md-callout-info: #3b82f6;
  --colla-md-callout-warning: #f59e0b;
  --colla-md-callout-danger: #ef4444;
  --colla-md-selection: rgba(59, 130, 246, 0.15);
`;

const DARK_THEME = `
  --colla-md-bg: #111827;
  --colla-md-fg: #f9fafb;
  --colla-md-border: #374151;
  --colla-md-code-bg: #1f2937;
  --colla-md-callout-info: #60a5fa;
  --colla-md-callout-warning: #fbbf24;
  --colla-md-callout-danger: #f87171;
  --colla-md-selection: rgba(96, 165, 250, 0.15);
`;

/**
 * 创建主题插件：为编辑器根节点注入 CSS 变量与主题类名。
 */
export function createThemePlugin(theme: ThemeConfig = 'light'): MilkdownPlugin {
  return (ctx) => async () => {
    await ctx.wait(EditorViewReady);
    const root = ctx.get(rootCtx);

    if (root instanceof HTMLElement) {
      root.classList.add('colla-md', `colla-md--${theme}`);
      root.style.cssText += theme === 'dark' ? DARK_THEME : LIGHT_THEME;
    }
  };
}
