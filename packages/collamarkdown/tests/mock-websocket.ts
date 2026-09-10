/**
 * 轻量级 WebSocket Mock，用于测试 CollaCoreProvider。
 *
 * 设计为单房间、多端互通：所有 MockWebSocket 实例连接到同一个 server，
 * 消息会被广播给所有其他实例。
 */

export interface MockServerOptions {
  /** 收到消息后的回调，返回可选的响应消息（二进制数组） */
  onMessage?: (client: MockWebSocket, data: Uint8Array) => Uint8Array[] | void;
}

export class MockWebSocketServer {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  private clients = new Set<MockWebSocket>();
  private options: MockServerOptions;

  constructor(options: MockServerOptions = {}) {
    this.options = options;
  }

  connect(client: MockWebSocket): void {
    this.clients.add(client);
    setTimeout(() => {
      client.readyState = MockWebSocketServer.OPEN;
      client.onopen?.(new Event('open'));
      client.emit('open', new Event('open'));
    }, 0);
  }

  disconnect(client: MockWebSocket): void {
    this.clients.delete(client);
    setTimeout(() => {
      client.readyState = MockWebSocketServer.CLOSED;
      client.onclose?.(new CloseEvent('close'));
      client.emit('close', new CloseEvent('close'));
    }, 0);
  }

  broadcast(sender: MockWebSocket, data: Uint8Array): void {
    for (const client of this.clients) {
      if (client === sender || client.readyState !== MockWebSocketServer.OPEN) continue;

      const responses = this.options.onMessage?.(client, data);
      if (responses) {
        for (const response of responses) {
          setTimeout(() => {
            client.onmessage?.({ data: response.buffer } as MessageEvent);
            client.emit('message', { data: response.buffer } as MessageEvent);
          }, 0);
        }
        continue;
      }

      setTimeout(() => {
        client.onmessage?.({ data: data.buffer } as MessageEvent);
        client.emit('message', { data: data.buffer } as MessageEvent);
      }, 0);
    }
  }
}

let globalServer: MockWebSocketServer | null = null;

type MockEventListener = (event: Event) => void;

export class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSING = 2;
  readonly CLOSED = 3;

  url: string;
  binaryType: BinaryType = 'arraybuffer';
  readyState = MockWebSocket.CONNECTING;

  onopen: MockEventListener | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: MockEventListener | null = null;

  private listeners = new Map<string, MockEventListener[]>();

  constructor(url: string | URL) {
    this.url = String(url);
    globalServer?.connect(this);
  }

  addEventListener(type: string, listener: MockEventListener): void {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }

  removeEventListener(type: string, listener: MockEventListener): void {
    const list = this.listeners.get(type) ?? [];
    this.listeners.set(
      type,
      list.filter((fn) => fn !== listener)
    );
  }

  emit(type: string, event: Event): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }

  send(data: ArrayBufferLike | ArrayBufferView | string): void {
    let payload: Uint8Array;
    if (typeof data === 'string') {
      payload = new TextEncoder().encode(data);
    } else if (ArrayBuffer.isView(data)) {
      payload = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    } else {
      payload = new Uint8Array(data);
    }
    globalServer?.broadcast(this, payload);
  }

  close(): void {
    globalServer?.disconnect(this);
  }
}

export function setupMockWebSocket(server: MockWebSocketServer = new MockWebSocketServer()): MockWebSocketServer {
  globalServer = server;

  // @ts-expect-error 替换全局 WebSocket 为 Mock
  global.WebSocket = MockWebSocket;

  return server;
}

export function teardownMockWebSocket(): void {
  globalServer = null;
}
