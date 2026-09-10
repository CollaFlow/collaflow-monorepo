import {
  type CollabRoom,
  type CollabUser,
  createCollabRoom,
  setLocalAwarenessUser,
} from '@collaflow/collab-core';
import { lightTheme, darkTheme } from '@collaflow/design';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let MindElixirCtor: any | undefined;

export type MindTheme = 'light' | 'dark';

export interface MindMapData {
  nodeData: {
    id: string;
    topic: string;
    root?: boolean;
    children?: MindMapData['nodeData'][];
  };
}

export interface MindMapOptions {
  el: HTMLElement;
  data?: MindMapData;
  theme?: MindTheme;
  room?: CollabRoom | { roomId: string };
  user?: CollabUser;
  onChange?: (data: MindMapData) => void;
}

export interface MindMapEditor {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  instance: any;
  getData: () => MindMapData;
  destroy: () => void;
}

async function loadMindElixir(): Promise<unknown> {
  if (MindElixirCtor) return MindElixirCtor;
  const mod = await import('mind-elixir');
  MindElixirCtor = (mod as { default?: unknown }).default ?? mod;
  return MindElixirCtor;
}

export async function createMindMap(options: MindMapOptions): Promise<MindMapEditor> {
  const resolvedRoom =
    options.room && 'doc' in options.room
      ? options.room
      : createCollabRoom(
          options.room && 'roomId' in options.room ? options.room.roomId : 'default',
        );

  if (options.user) {
    setLocalAwarenessUser(resolvedRoom.awareness, options.user);
  }

  const MindElixir = (await loadMindElixir()) as new (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    opts: Record<string, any>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) => any;

  const resolvedTheme = options.theme ?? 'light';
  const themeColors = resolvedTheme === 'dark' ? darkTheme.colors : lightTheme.colors;

  const instance = new MindElixir({
    el: options.el,
    data:
      options.data ??
      ({
        nodeData: { id: 'root', topic: 'Root', root: true },
      } as MindMapData),
    style: {
      background: themeColors.background.primary,
      color: themeColors.text.primary,
    },
  });

  instance.init();

  const originalRefresh = instance.refresh;
  instance.refresh = function (data: MindMapData) {
    options.onChange?.(data);
    return originalRefresh.call(instance, data);
  };

  return {
    instance,
    getData: () => instance.getData() as MindMapData,
    destroy: () => {
      instance.destroy();
      resolvedRoom.doc.destroy();
    },
  };
}

export {
  type CollabRoom,
  type CollabUser,
  createCollabRoom,
  setLocalAwarenessUser,
  getAwarenessUsers,
} from '@collaflow/collab-core';
export { colors, lightTheme, darkTheme } from '@collaflow/design';
