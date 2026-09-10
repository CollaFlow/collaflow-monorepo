import { refractor } from 'refractor';
import { prism, prismConfig } from '@milkdown/plugin-prism';
import type { MilkdownPlugin, Ctx } from '@milkdown/ctx';

import type { HighlightOptions } from '../../types';

/**
 * 默认加载的代码高亮语言。
 */
const DEFAULT_LANGUAGES = [
  'javascript',
  'typescript',
  'tsx',
  'jsx',
  'html',
  'css',
  'markdown',
  'json',
  'bash',
  'python',
];

/**
 * 配置 refractor 高亮语言。
 */
export function configureHighlightLanguages(languages: string[]): void {
  for (const lang of languages) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const langModule = require(`refractor/lang/${lang}.js`);
      refractor.register(langModule.default ?? langModule);
    } catch {
      // 语言包不存在时静默跳过
    }
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

  configureHighlightLanguages(DEFAULT_LANGUAGES);

  return {
    plugins: prism,
    configure: (ctx) => {
      ctx.set(prismConfig.key, { configureRefractor: (r) => r });
    },
  };
}

export { refractor, prism, prismConfig };
