import * as Y from 'yjs';
import { Editor, defaultValueCtx, editorViewCtx, rootCtx } from '@milkdown/core';
import type { Ctx, MilkdownPlugin } from '@milkdown/ctx';
import { commonmark } from '@milkdown/preset-commonmark';
import { listener, listenerCtx } from '@milkdown/plugin-listener';
import { getMarkdown, replaceAll } from '@milkdown/utils';
import { block } from '@milkdown/plugin-block';
import type { EditorView } from 'prosemirror-view';

import type { CollaMarkdownEditor, CollaMarkdownEditorOptions } from '../types';
import { resolveEditorOptions } from './options';
import { CollaFlowProvider, createCollabPlugins, unescapeLeadingHash } from '../collab';
import { createHighlightPlugin, layoutNodes, createThemePlugin } from './plugins';

/**
 * 构建编辑器所需的 Milkdown 插件列表。
 *
 * 协同绑定以 Markdown 文本（Y.Text）为唯一真相：源码区与预览区都读写同一份文本，
 * Y.Text 的字符级 CRDT 自动合并多人并发编辑。
 */
function buildPlugins(
  resolved: ReturnType<typeof resolveEditorOptions>,
  content: Y.Text,
): { plugins: MilkdownPlugin[]; configureHighlight?: (ctx: Ctx) => void } {
  const highlight = resolved.highlight
    ? createHighlightPlugin(resolved.highlight === true ? undefined : resolved.highlight)
    : null;

  const plugins: MilkdownPlugin[] = [
    createThemePlugin(resolved.theme),
    ...(highlight?.plugins ?? []),
    ...layoutNodes,
    ...(resolved.plugins ?? []),
    createCollabPlugins(content),
  ];

  return { plugins, configureHighlight: highlight?.configure };
}

/**
 * 注册在线用户列表变化监听。
 */
function setupAwarenessChangeListener(
  provider: CollaFlowProvider | null,
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
 * - 以 Markdown 文本（Y.Text）为唯一真相的可选协同：源码区与预览区都读写同一份文本
 * - 自定义布局节点（Callout / Columns / Column / Card）
 * - CollaFlow 主题 CSS 变量
 */
export async function createEditor(
  options: CollaMarkdownEditorOptions
): Promise<CollaMarkdownEditor> {
  const resolved = resolveEditorOptions(options);

  const provider = resolved.collab ? new CollaFlowProvider(resolved.collab) : null;
  // 协同取共享文档的 content；本地模式用独立 Y.Doc 承载同一份文本，行为一致。
  const content = provider ? provider.content : new Y.Doc().getText('content');
  if (content.length === 0 && resolved.defaultValue) {
    content.insert(0, resolved.defaultValue);
  }

  const { plugins: dynamicPlugins, configureHighlight } = buildPlugins(resolved, content);

  const editor = await Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, resolved.root);
      ctx.set(defaultValueCtx, resolved.defaultValue);

      configureHighlight?.(ctx);

      if (resolved.onChange) {
        ctx.get(listenerCtx).markdownUpdated((_, markdown) => {
          resolved.onChange!(unescapeLeadingHash(markdown));
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
    get content() {
      return content;
    },
    getView(): EditorView {
      return editor.action((ctx) => ctx.get(editorViewCtx)) as unknown as EditorView;
    },
    getMarkdown() {
      return unescapeLeadingHash(editor.action(getMarkdown()));
    },
    async setMarkdown(value: string) {
      await editor.action(replaceAll(value));
    },
    getAwarenessUsers() {
      return provider?.getAwarenessUsers() ?? [];
    },
    setLocalSelection(anchor: number, head: number): void {
      provider?.setLocalSelection(anchor, head);
    },
    getRemoteCursors() {
      return provider?.getRemoteCursors() ?? [];
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
