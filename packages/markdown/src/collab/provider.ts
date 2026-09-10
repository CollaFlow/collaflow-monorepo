import * as Y from 'yjs';
import * as awarenessProtocol from 'y-protocols/awareness';
import { HocuspocusProvider } from '@hocuspocus/provider';

import type { CollabOptions, AwarenessUserInfo, AwarenessUserState } from '../types';
import {
  decodeSelection,
  encodeRelativePosition,
  type EncodedSelection,
  type RemoteCursor,
} from './cursor';

/**
 * CollaFlow 协同 Provider。
 *
 * 职责：
 * - 维护 Y.Doc 与 Awareness 实例
 * - 通过 @hocuspocus/provider 与 CollaFlow Core 的 Hocuspocus 服务通信
 * - 暴露在线用户列表
 *
 * 传输层（Yjs sync + awareness 协议）完全交给 Hocuspocus，
 * 本类只做生命周期与本地状态的收口。
 */
export class CollaFlowProvider {
  readonly doc: Y.Doc;
  readonly awareness: awarenessProtocol.Awareness;

  private readonly provider: HocuspocusProvider;
  private connected = false;

  constructor(options: CollabOptions) {
    this.doc = new Y.Doc();
    this.awareness = new awarenessProtocol.Awareness(this.doc);

    if (options.user) {
      this.awareness.setLocalState({ user: options.user });
    }

    this.provider = new HocuspocusProvider({
      url: options.serverUrl,
      name: options.roomId,
      document: this.doc,
      awareness: this.awareness,
      onStatus: ({ status }) => {
        this.connected = status === 'connected';
      },
    });
  }

  /**
   * 当前是否已与协同服务建立连接。
   */
  get isConnected(): boolean {
    return this.connected;
  }

  /**
   * 协同内容源：以 Markdown 文本为唯一真相的 Y.Text。
   *
   * 源码区与预览区都读写这一份文本；协同（Hocuspocus）只负责同步它，
   * 因此多人编辑按字符级 CRDT 合并，不会再出现「整体替换」式的覆盖。
   */
  get content(): Y.Text {
    return this.doc.getText('content');
  }

  /**
   * 获取当前在线用户列表。
   */
  getAwarenessUsers(): AwarenessUserState[] {
    const users: AwarenessUserState[] = [];

    this.awareness.getStates().forEach((state, clientId) => {
      const user = state?.user as AwarenessUserInfo | undefined;
      if (user?.name && user?.color) {
        users.push({ clientId, user });
      }
    });

    return users;
  }

  /**
   * 建立连接。
   */
  connect(): void {
    this.provider.connect();
  }

  /**
   * 上报本地选区（以 Y.Text 字符偏移表示）。
   *
   * 会被编码为相对位置存入 awareness，随并发编辑自愈，避免光标错位。
   */
  setLocalSelection(anchor: number, head: number): void {
    const selection: EncodedSelection = {
      anchor: encodeRelativePosition(this.content, anchor),
      head: encodeRelativePosition(this.content, head),
    };
    this.awareness.setLocalStateField('selection', selection);
  }

  /**
   * 读取远端用户的光标列表（已解码为 Y.Text 绝对偏移）。
   */
  getRemoteCursors(): RemoteCursor[] {
    const cursors: RemoteCursor[] = [];

    this.awareness.getStates().forEach((state, clientId) => {
      if (clientId === this.doc.clientID) return;
      const user = state?.user as AwarenessUserInfo | undefined;
      const selection = state?.selection as EncodedSelection | undefined;
      if (!user?.name || !user?.color || !selection) return;

      const offsets = decodeSelection(this.content, selection);
      if (!offsets) return;

      cursors.push({ clientId, user, anchor: offsets.anchor, head: offsets.head });
    });

    return cursors;
  }

  /**
   * 断开连接（保留本地 doc 内容，可再次 connect）。
   */
  disconnect(): void {
    this.provider.disconnect();
  }

  /**
   * 销毁 Provider，清理连接与 Yjs 资源。
   */
  destroy(): void {
    this.provider.destroy();
    this.awareness.destroy();
    this.doc.destroy();
  }
}
