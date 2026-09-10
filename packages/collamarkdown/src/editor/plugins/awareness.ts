import { yCursorPlugin } from 'y-prosemirror';
import type { Awareness } from 'y-protocols/awareness';

import type { AwarenessUserInfo } from '../../types';

/**
 * 自定义远端用户光标渲染。
 */
export function collaCursorBuilder(user: AwarenessUserInfo, _clientId: number): HTMLElement {
  const cursor = document.createElement('span');
  cursor.className = 'colla-cursor';
  cursor.style.borderLeft = `2px solid ${user.color}`;
  cursor.style.marginLeft = '-1px';
  cursor.style.height = '1.2em';
  cursor.style.display = 'inline-block';
  cursor.style.position = 'relative';

  const label = document.createElement('span');
  label.className = 'colla-cursor-label';
  label.textContent = user.name;
  label.style.backgroundColor = user.color;
  label.style.color = '#fff';
  label.style.position = 'absolute';
  label.style.top = '-1.4em';
  label.style.left = '-2px';
  label.style.fontSize = '10px';
  label.style.padding = '2px 4px';
  label.style.borderRadius = '2px';
  label.style.whiteSpace = 'nowrap';

  cursor.appendChild(label);
  return cursor;
}

/**
 * 自定义远端用户选区高亮渲染。
 */
export function collaSelectionBuilder(user: AwarenessUserInfo) {
  return {
    class: 'colla-selection',
    style: `background-color: ${user.color}33;`,
  };
}

/**
 * 创建 Awareness 光标/选区插件。
 */
export function createAwarenessPlugin(awareness: Awareness): unknown {
  return yCursorPlugin(awareness, {
    cursorBuilder: collaCursorBuilder as (user: unknown, clientId: number) => HTMLElement,
    selectionBuilder: collaSelectionBuilder as (user: unknown) => {
      class: string;
      style: string;
    },
  });
}
