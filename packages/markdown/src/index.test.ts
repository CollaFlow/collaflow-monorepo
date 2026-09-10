import { describe, it, expect } from 'vitest';
import { createMarkdownEditor } from './index';

describe('markdown', () => {
  it('creates a markdown editor instance', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const editor = createMarkdownEditor({ element: el });
    expect(editor.editor).toBeDefined();
    expect(typeof editor.getHTML).toBe('function');
    editor.destroy();
    document.body.removeChild(el);
  });
});
