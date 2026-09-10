import type * as Y from 'yjs';
import type { Awareness } from 'y-protocols/awareness';

/**
 * HocuspocusProvider 的测试替身。
 *
 * 真正的 HocuspocusProvider 会立刻开 WebSocket，
 * 单测里只需要它记录配置、允许手动驱动状态回调。
 */
export interface FakeProviderConfiguration {
  url: string;
  name: string;
  document: Y.Doc;
  awareness: Awareness;
  onStatus?: (data: { status: string }) => void;
}

export const fakeProviderInstances: FakeHocuspocusProvider[] = [];

export class FakeHocuspocusProvider {
  readonly configuration: FakeProviderConfiguration;
  connectCalls = 0;
  disconnectCalls = 0;
  destroyCalls = 0;

  constructor(configuration: FakeProviderConfiguration) {
    this.configuration = configuration;
    fakeProviderInstances.push(this);
  }

  connect(): void {
    this.connectCalls += 1;
  }

  disconnect(): void {
    this.disconnectCalls += 1;
  }

  destroy(): void {
    this.destroyCalls += 1;
  }

  /** 模拟服务端状态变化。 */
  emitStatus(status: string): void {
    this.configuration.onStatus?.({ status });
  }
}

export function resetFakeProviders(): void {
  fakeProviderInstances.length = 0;
}

export function latestFakeProvider(): FakeHocuspocusProvider {
  const provider = fakeProviderInstances[fakeProviderInstances.length - 1];
  if (!provider) {
    throw new Error('No FakeHocuspocusProvider has been created');
  }
  return provider;
}
