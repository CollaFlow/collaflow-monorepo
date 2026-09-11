import { $prose } from '@milkdown/utils';
import { Plugin } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';

/**
 * 任务列表点击切换插件。
 *
 * 当用户点击 GFM 任务列表项（`data-item-type="task"`）左侧的复选框区域时，
 * 切换该 list_item 的 `checked` 属性。
 *
 * 点击判定：命中 li 左侧约 24px 的复选框热区，避免与正文编辑冲突。
 */
export const taskListTogglePlugin = $prose(() => {
  const TOGGLE_HOTSPOT_WIDTH = 24;

  function toggleIfHitCheckbox(view: EditorView, event: MouseEvent): boolean {
    let handled = false;

    const target = event.target as HTMLElement | null;
    if (target) {
      const li = target.closest('li[data-item-type="task"]') as HTMLElement | null;
      if (li) {
        const rect = li.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        if (clickX <= TOGGLE_HOTSPOT_WIDTH) {
          const pos = view.posAtDOM(li, 0);
          if (pos != null) {
            // 点击位置可能落在 li 内部的 paragraph/text 上，向上查找 list_item 祖先
            const resolved = view.state.doc.resolve(pos);
            for (let depth = resolved.depth; depth > 0; depth--) {
              const node = resolved.node(depth);
              if (node.type.name === 'list_item' && node.attrs.checked != null) {
                const nodePos = resolved.before(depth);
                const tr = view.state.tr;
                tr.setNodeMarkup(nodePos, undefined, {
                  ...node.attrs,
                  checked: !node.attrs.checked,
                });
                view.dispatch(tr);
                handled = true;
                break;
              }
            }
          }
        }
      }
    }

    return handled;
  }

  return new Plugin({
    props: {
      handleDOMEvents: {
        click(view, event) {
          return toggleIfHitCheckbox(view, event as MouseEvent);
        },
      },
    },
  });
});
