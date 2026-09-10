import { Editor, type AnyExtension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import * as Y from 'yjs';
import {
  type CollabRoom,
  type CollabUser,
  createCollabRoom,
  setLocalAwarenessUser,
  getAwarenessUsers,
} from '@collaflow/collab-core';
import { lightTheme, darkTheme } from '@collaflow/design';

export type MarkdownTheme = 'light' | 'dark';

export interface MarkdownEditorOptions {
  element: HTMLElement;
  content?: string;
  theme?: MarkdownTheme;
  room?: CollabRoom | { roomId: string; doc?: Y.Doc };
  user?: CollabUser;
  onChange?: (html: string) => void;
  editable?: boolean;
}

export interface MarkdownEditor {
  editor: Editor;
  getHTML: () => string;
  setHTML: (html: string) => void;
  getAwarenessUsers: () => ReturnType<typeof getAwarenessUsers>;
  destroy: () => void;
}

export function createMarkdownEditor(options: MarkdownEditorOptions): MarkdownEditor {
  const resolvedRoom =
    options.room && 'doc' in options.room && options.room.doc
      ? (options.room as CollabRoom)
      : createCollabRoom(
          options.room && 'roomId' in options.room ? options.room.roomId : 'default',
        );

  const extensions: AnyExtension[] = [StarterKit.configure({ history: false })];

  extensions.push(Collaboration.configure({ document: resolvedRoom.doc }));
  if (options.user) {
    setLocalAwarenessUser(resolvedRoom.awareness, options.user);
  }

  const resolvedTheme = options.theme ?? 'light';
  const themeColors = resolvedTheme === 'dark' ? darkTheme.colors : lightTheme.colors;
  options.element.style.backgroundColor = themeColors.background.primary;
  options.element.style.color = themeColors.text.primary;

  const editor = new Editor({
    element: options.element,
    editable: options.editable ?? true,
    content: options.content,
    extensions,
    onUpdate: ({ editor }) => {
      options.onChange?.(editor.getHTML());
    },
  });

  return {
    editor,
    getHTML: () => editor.getHTML(),
    setHTML: (html: string) => editor.commands.setContent(html, false),
    getAwarenessUsers: () => getAwarenessUsers(resolvedRoom.awareness),
    destroy: () => {
      editor.destroy();
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
