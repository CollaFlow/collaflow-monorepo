import { refractor } from 'refractor';
import type { Syntax } from 'refractor/core';
import { prism, prismConfig } from '@milkdown/plugin-prism';
import type { MilkdownPlugin, Ctx } from '@milkdown/ctx';

// refractor 的 exports 为 `./* -> ./lang/*.js`，所以语言子路径不带 lang/ 前缀
import bash from 'refractor/bash';
import css from 'refractor/css';
import javascript from 'refractor/javascript';
import json from 'refractor/json';
import jsx from 'refractor/jsx';
import markdown from 'refractor/markdown';
// HTML 在 refractor 里对应 markup（别名 html）
import markup from 'refractor/markup';
import python from 'refractor/python';
import tsx from 'refractor/tsx';
import typescript from 'refractor/typescript';

import type { HighlightOptions } from '../../types';

/**
 * 默认注册的代码高亮语法。
 *
 * 顺序有意义：typescript / tsx / jsx 依赖 javascript，markdown 依赖 markup。
 */
export const DEFAULT_SYNTAXES: Syntax[] = [
  javascript,
  typescript,
  tsx,
  jsx,
  markup,
  css,
  markdown,
  json,
  bash,
  python,
];

/**
 * 注册 refractor 高亮语法。
 */
export function configureHighlightLanguages(syntaxes: Syntax[]): void {
  for (const syntax of syntaxes) {
    refractor.register(syntax);
  }
}

export interface HighlightPluginResult {
  plugins: MilkdownPlugin[];
  configure?: (ctx: Ctx) => void;
}

/**
 * 创建代码高亮插件。
 */
export function createHighlightPlugin(options?: HighlightOptions): HighlightPluginResult {
  const isShiki = options?.type === 'shiki';

  if (isShiki) {
    // TODO: Phase 4+ 可切换为 Shiki
    return { plugins: prism };
  }

  configureHighlightLanguages(DEFAULT_SYNTAXES);

  return {
    plugins: prism,
    configure: (ctx) => {
      ctx.set(prismConfig.key, { configureRefractor: (r) => r });
    },
  };
}

export { refractor, prism, prismConfig };
