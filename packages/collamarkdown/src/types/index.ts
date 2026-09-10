import type { Editor } from '@milkdown/core';
import type { MilkdownPlugin } from '@milkdown/ctx';

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
  /** 房间/文档 ID */
  roomId: string;
  /** 当前用户 ID */
  userId: string;
  /** CollaCore 服务 WebSocket 地址 */
  serverUrl: string;
  /** 用户 Awareness 信息 */
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
  /** 获取当前 Markdown 内容 */
  getMarkdown(): string;
  /** 设置 Markdown 内容（会重置编辑器状态） */
  setMarkdown(value: string): Promise<void>;
  /** 获取当前在线用户列表（需启用协同） */
  getAwarenessUsers(): AwarenessUserState[];
  /** 销毁编辑器并清理资源 */
  destroy(): Promise<void>;
}
