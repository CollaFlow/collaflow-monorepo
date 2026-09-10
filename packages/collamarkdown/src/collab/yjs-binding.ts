import * as Y from 'yjs';
import type { Awareness } from 'y-protocols/awareness';
import { ySyncPlugin, yUndoPlugin } from 'y-prosemirror';
import type { MilkdownPlugin } from '@milkdown/ctx';
import { InitReady, prosePluginsCtx } from '@milkdown/core';

import { createAwarenessPlugin } from '../editor/plugins/awareness';

/**
 * 创建 Milkdown 协同插件集合。
 *
 * 将 y-prosemirror 的 sync / cursor / undo 插件注入到 Milkdown 的 ProseMirror 插件列表中。
 */
export function createCollabPlugins(
  yXmlFragment: Y.XmlFragment,
  awareness: Awareness
): MilkdownPlugin {
  return (ctx) => async () => {
    await ctx.wait(InitReady);

    const plugins = [ySyncPlugin(yXmlFragment), createAwarenessPlugin(awareness), yUndoPlugin()];

    ctx.update(prosePluginsCtx, (prev) => prev.concat(plugins));
  };
}
