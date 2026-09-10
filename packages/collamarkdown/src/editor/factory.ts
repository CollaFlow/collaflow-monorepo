import { Editor, defaultValueCtx, rootCtx } from '@milkdown/core';
import type { Ctx, MilkdownPlugin } from '@milkdown/ctx';
import { commonmark } from '@milkdown/preset-commonmark';
import { listener, listenerCtx } from '@milkdown/plugin-listener';
import { getMarkdown, replaceAll } from '@milkdown/utils';
import { block } from '@milkdown/plugin-block';

import type { CollaMarkdownEditor, CollaMarkdownEditorOptions } from '../types';
import { resolveEditorOptions } from './options';
import { CollaCoreProvider, createCollabPlugins } from '../collab';
import { createHighlightPlugin } from './plugins/highlight';
import { layoutNodes } from './plugins/layout';
import { createThemePlugin } from './plugins/theme';

/**
 * 构建编辑器所需的 Milkdown 插件列表。
 */
function buildPlugins(
  resolved: ReturnType<typeof resolveEditorOptions>,
  provider: CollaCoreProvider | null
): { plugins: MilkdownPlugin[]; configureHighlight?: (ctx: Ctx) => void } {
  const collabPlugins: MilkdownPlugin[] = [];
  if (provider) {
    const yXmlFragment = provider.doc.getXmlFragment('prosemirror');
    collabPlugins.push(createCollabPlugins(yXmlFragment, provider.awareness));
  }

  const highlight = resolved.highlight
    ? createHighlightPlugin(resolved.highlight === true ? undefined : resolved.highlight)
    : null;

  const plugins: MilkdownPlugin[] = [
    createThemePlugin(resolved.theme),
    ...(highlight?.plugins ?? []),
    ...layoutNodes,
    ...(resolved.plugins ?? []),
    ...collabPlugins,
  ];

  return { plugins, configureHighlight: highlight?.configure };
}

/**
 * 注册在线用户列表变化监听。
 */
function setupAwarenessChangeListener(
  provider: CollaCoreProvider | null,
  onChange: CollaMarkdownEditorOptions['onAwarenessChange']
): (() => void) | null {
  if (!provider || !onChange) return null;

  const handler = () => onChange(provider.getAwarenessUsers());
  provider.awareness.on('change', handler);
  handler(); // 初始触发一次

  return () => provider.awareness.off('change', handler);
}

/**
 * 创建 CollaMarkdown 编辑器实例。
 *
 * Phase 1~4 实现能力：
 * - 基于 Milkdown 渲染 Markdown
 * - 接入 listener 插件，支持 onChange 回调
 * - 默认启用 commonmark、prism 代码高亮、block 菜单
 * - 可选接入 CollaCore Yjs 协同与 Awareness
 * - 自定义布局节点（Callout / Columns / Column / Card）
 * - CollaFlow 主题 CSS 变量
 */
export async function createEditor(
  options: CollaMarkdownEditorOptions
): Promise<CollaMarkdownEditor> {
  const resolved = resolveEditorOptions(options);

  const provider = resolved.collab ? new CollaCoreProvider(resolved.collab) : null;
  const { plugins: dynamicPlugins, configureHighlight } = buildPlugins(resolved, provider);

  const editor = await Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, resolved.root);
      ctx.set(defaultValueCtx, resolved.defaultValue);

      configureHighlight?.(ctx);

      if (resolved.onChange) {
        ctx.get(listenerCtx).markdownUpdated((_, markdown) => {
          resolved.onChange!(markdown);
        });
      }
    })
    .use(commonmark)
    .use(listener)
    .use(block)
    .use(dynamicPlugins)
    .create();

  if (provider) {
    provider.connect();
  }

  const removeAwarenessChangeListener = setupAwarenessChangeListener(
    provider,
    resolved.onAwarenessChange
  );

  return {
    get editor() {
      return editor;
    },
    getMarkdown() {
      return editor.action(getMarkdown());
    },
    async setMarkdown(value: string) {
      await editor.action(replaceAll(value));
    },
    getAwarenessUsers() {
      return provider?.getAwarenessUsers() ?? [];
    },
    async destroy() {
      removeAwarenessChangeListener?.();
      if (provider) {
        provider.destroy();
        // 给 y-prosemirror 预留一个 tick 清理 pending 的 setMeta timeout
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      await editor.destroy();
    },
  };
}
