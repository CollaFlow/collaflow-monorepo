import type { Editor } from '@milkdown/core';
import type { MilkdownPlugin } from '@milkdown/ctx';

import type * as Y from 'yjs';
import type { EditorView } from 'prosemirror-view';

import type { RemoteCursor } from '../collab/cursor';

/**
 * 协同用户信息。
 */
export interface AwarenessUserInfo {
  /** 显示名称 */
  name: string;
  /** 用户颜色（HEX 格式） */
  color: string;
  /** 头像 URL（可选） */
  avatar?: string;
}

/**
 * 在线用户状态。
 */
export interface AwarenessUserState {
  /** Yjs 客户端 ID */
  clientId: number;
  /** 用户信息 */
  user: AwarenessUserInfo;
}

/**
 * 协同配置。
 */
export interface CollabOptions {
  /** 房间/文档 ID（对应 Hocuspocus 文档名） */
  roomId: string;
  /** CollaFlow Core（Hocuspocus 协同服务）的 WebSocket 地址，如 ws://localhost:1234 */
  serverUrl: string;
  /** 用户 Awareness 信息（用于光标/在线列表展示） */
  user?: AwarenessUserInfo;
}

/**
 * 代码高亮配置。
 */
export interface HighlightOptions {
  /** 高亮器类型 */
  type: 'prism' | 'shiki';
}

/**
 * 主题配置。
 */
export type ThemeConfig = 'light' | 'dark';

/**
 * CollaMarkdown 编辑器配置。
 */
export interface CollaMarkdownEditorOptions {
  /** 挂载节点 */
  root: HTMLElement;
  /** 初始 Markdown 内容 */
  defaultValue?: string;
  /** 是否启用协同 */
  collab?: CollabOptions;
  /** 是否启用代码高亮 */
  highlight?: boolean | HighlightOptions;
  /** 主题配置 */
  theme?: ThemeConfig;
  /** 额外 Milkdown 插件 */
  plugins?: MilkdownPlugin[];
  /** 内容变更回调 */
  onChange?: (markdown: string) => void;
  /** 在线用户列表变化回调 */
  onAwarenessChange?: (users: AwarenessUserState[]) => void;
}

/**
 * CollaMarkdown 编辑器实例。
 */
export interface CollaMarkdownEditor {
  /** 底层 Milkdown Editor 实例 */
  readonly editor: Editor;
  /** 协同内容源：以 Markdown 文本为唯一真相的 Yjs Y.Text（未启用协同时为本地文档） */
  readonly content: Y.Text;
  /** 获取底层 ProseMirror 视图（用于预览区光标定位） */
  getView(): EditorView;
  /** 获取当前 Markdown 内容 */
  getMarkdown(): string;
  /** 设置 Markdown 内容（会重置编辑器状态） */
  setMarkdown(value: string): Promise<void>;
  /** 获取当前在线用户列表（需启用协同） */
  getAwarenessUsers(): AwarenessUserState[];
  /** 上报本地选区（Y.Text 字符偏移），用于远端光标显示 */
  setLocalSelection(anchor: number, head: number): void;
  /** 获取远端光标列表（已解码为 Y.Text 绝对偏移，需启用协同） */
  getRemoteCursors(): RemoteCursor[];
  /** 销毁编辑器并清理资源 */
  destroy(): Promise<void>;
}
