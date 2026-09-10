import * as Y from 'yjs';
import * as awarenessProtocol from 'y-protocols/awareness';

import type { CollabOptions, AwarenessUserInfo, AwarenessUserState } from '../types';

/**
 * CollaCore 房间消息类型。
 *
 * 与 collacore 的 RoomMessageType 保持一致：
 * - 0x00: Yjs document update
 * - 0x01: Yjs awareness update
 */
export enum CollaCoreMessageType {
  Update = 0x00,
  Awareness = 0x01,
}

/**
 * CollaCore 协同 Provider。
 *
 * 职责：
 * - 维护 Y.Doc 与 Awareness 实例
 * - 通过 WebSocket 与 CollaCore 房间服务通信
 * - 转发 Yjs update 与 awareness 消息
 */
export class CollaCoreProvider {
  readonly doc: Y.Doc;
  readonly awareness: awarenessProtocol.Awareness;

  private readonly roomId: string;
  private readonly userId: string;
  private readonly serverUrl: string;
  private readonly user?: AwarenessUserInfo;

  private ws: WebSocket | null = null;
  private connected = false;

  private readonly removeDocUpdateListener: () => void;
  private readonly removeAwarenessUpdateListener: () => void;

  constructor(options: CollabOptions) {
    this.roomId = options.roomId;
    this.userId = options.userId;
    this.serverUrl = options.serverUrl;
    this.user = options.user;

    this.doc = new Y.Doc();
    this.awareness = new awarenessProtocol.Awareness(this.doc);

    if (this.user) {
      this.awareness.setLocalState({ user: this.user });
    }

    this.removeDocUpdateListener = this.setupDocUpdateListener();
    this.removeAwarenessUpdateListener = this.setupAwarenessUpdateListener();
  }

  /**
   * 当前是否已连接。
   */
  get isConnected(): boolean {
    return this.connected;
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
   * 建立 WebSocket 连接。
   */
  connect(): void {
    if (this.ws) return;

    this.ws = new WebSocket(this.buildWebSocketUrl());
    this.ws.binaryType = 'arraybuffer';

    this.ws.addEventListener('open', () => this.handleOpen());
    this.ws.addEventListener('message', (event) => this.handleRawMessage(event));
    this.ws.addEventListener('close', () => this.handleClose());
    this.ws.addEventListener('error', (err) => this.handleError(err));
  }

  /**
   * 断开 WebSocket 连接。
   */
  disconnect(): void {
    if (!this.ws) return;
    this.ws.close();
    this.ws = null;
    this.connected = false;
  }

  /**
   * 销毁 Provider，清理所有监听器与连接。
   */
  destroy(): void {
    this.disconnect();
    this.removeDocUpdateListener();
    this.removeAwarenessUpdateListener();
    this.awareness.destroy();
    this.doc.destroy();
  }

  /**
   * 构造 WebSocket URL。
   */
  private buildWebSocketUrl(): string {
    const encodedRoomId = encodeURIComponent(this.roomId);
    const encodedUserId = encodeURIComponent(this.userId);
    return `${this.serverUrl}/ws/rooms/${encodedRoomId}?userId=${encodedUserId}`;
  }

  /**
   * 发送 awareness 更新。
   */
  private sendAwarenessUpdate(clientIds: number[]): void {
    const update = awarenessProtocol.encodeAwarenessUpdate(this.awareness, clientIds);
    this.send(CollaCoreMessageType.Awareness, update);
  }

  /**
   * 发送二进制消息。
   */
  private send(type: CollaCoreMessageType, payload: Uint8Array): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const message = new Uint8Array(1 + payload.length);
    message[0] = type;
    message.set(payload, 1);

    try {
      this.ws.send(message);
    } catch (err) {
      console.error('Failed to send CollaCore message:', err);
    }
  }

  /**
   * 连接打开处理。
   */
  private handleOpen(): void {
    this.connected = true;

    const update = Y.encodeStateAsUpdate(this.doc);
    this.send(CollaCoreMessageType.Update, update);

    this.sendAwarenessUpdate([this.doc.clientID]);
  }

  /**
   * 收到原始消息处理。
   */
  private handleRawMessage(event: MessageEvent): void {
    const data = new Uint8Array(event.data as ArrayBuffer);
    this.handleMessage(data);
  }

  /**
   * 连接关闭处理。
   */
  private handleClose(): void {
    this.connected = false;
    this.ws = null;
  }

  /**
   * 错误处理。
   */
  private handleError(err: Event): void {
    console.error(`CollaCoreProvider error for room ${this.roomId}:`, err);
  }

  /**
   * 处理收到的 WebSocket 消息。
   */
  private handleMessage(data: Uint8Array): void {
    if (data.length === 0) return;

    const type = data[0] as CollaCoreMessageType;
    const payload = data.slice(1);

    switch (type) {
      case CollaCoreMessageType.Update:
        Y.applyUpdate(this.doc, payload, this);
        break;
      case CollaCoreMessageType.Awareness:
        this.handleAwarenessMessage(payload);
        break;
      default:
        console.warn(`Unknown CollaCore message type: ${type}`);
    }
  }

  /**
   * 处理 awareness 消息。
   *
   * 当有新远端客户端加入时，主动广播一次本地 awareness，
   * 确保新加入者能立即感知到当前用户。
   */
  private handleAwarenessMessage(payload: Uint8Array): void {
    const knownBefore = new Set(this.awareness.getStates().keys());

    awarenessProtocol.applyAwarenessUpdate(this.awareness, payload, this);

    const hasNewClient = Array.from(this.awareness.getStates().keys()).some(
      (id) => !knownBefore.has(id) && id !== this.doc.clientID
    );

    if (hasNewClient) {
      this.sendAwarenessUpdate([this.doc.clientID]);
    }
  }

  /**
   * 监听本地 Yjs document update。
   */
  private setupDocUpdateListener(): () => void {
    const handler = (update: Uint8Array, origin: unknown) => {
      if (origin === this) return;
      this.send(CollaCoreMessageType.Update, update);
    };

    this.doc.on('update', handler);
    return () => this.doc.off('update', handler);
  }

  /**
   * 监听本地 Awareness update。
   */
  private setupAwarenessUpdateListener(): () => void {
    const handler = (
      { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
      origin: unknown
    ) => {
      if (origin === this) return;

      const changedClients = [...added, ...updated, ...removed];
      this.sendAwarenessUpdate(changedClients);
    };

    this.awareness.on('update', handler);
    return () => this.awareness.off('update', handler);
  }
}
