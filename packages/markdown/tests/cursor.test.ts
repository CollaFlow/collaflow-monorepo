import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import { createEditor, buildDomTextCounts, markdownOffsetToDomTextOffset } from '../src/index';
import {
  decodeOffset,
  decodeSelection,
  encodeRelativePosition,
  unescapeLeadingHash,
} from '../src/collab';
import type { EncodedSelection } from '../src/collab';

describe('@collaflow/markdown/cursor', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('相对位置应随并发插入自愈（不是裸下标）', () => {
    const doc = new Y.Doc();
    const text = doc.getText('x');
    text.insert(0, 'hello world');

    const enc = encodeRelativePosition(text, 5);
    expect(decodeOffset(text, enc)).toBe(5);

    // 在开头插入字符，相对位置应后移
    text.insert(0, 'X');
    expect(decodeOffset(text, enc)).toBe(6);
  });

  it('位置随编辑被移除时应安全收敛到起点', () => {
    const doc = new Y.Doc();
    const text = doc.getText('x');
    text.insert(0, 'abc');

    const enc = encodeRelativePosition(text, 1);
    text.delete(0, 3); // 整段删除后相对位置会收敛到父类型起点
    // 安全收敛到 0，而不是返回非法值或抛出
    expect(decodeOffset(text, enc)).toBe(0);
  });

  it('decodeSelection 应解码为绝对偏移', () => {
    const doc = new Y.Doc();
    const text = doc.getText('x');
    text.insert(0, 'collaborative');

    const selection: EncodedSelection = {
      anchor: encodeRelativePosition(text, 2),
      head: encodeRelativePosition(text, 7),
    };
    expect(decodeSelection(text, selection)).toEqual({ anchor: 2, head: 7 });
  });

  it('decodeOffset 对非法编码应返回 null', () => {
    const doc = new Y.Doc();
    const text = doc.getText('x');
    text.insert(0, 'abc');
    expect(decodeOffset(text, '###')).toBeNull();
  });

  it('decodeSelection 任一端非法应返回 null', () => {
    const doc = new Y.Doc();
    const text = doc.getText('x');
    text.insert(0, 'abc');
    expect(
      decodeSelection(text, {
        anchor: encodeRelativePosition(text, 1),
        head: '###',
      }),
    ).toBeNull();
  });

  it('unescapeLeadingHash 应只去掉行首 # 的转义', () => {
    expect(unescapeLeadingHash('#foo')).toBe('#foo');
    expect(unescapeLeadingHash('#')).toBe('#');
    expect(unescapeLeadingHash('# 3')).toBe('# 3');
    expect(unescapeLeadingHash('a\n#b')).toBe('a\n#b');
    expect(unescapeLeadingHash('abc#')).toBe('abc#'); // 行内 # 不转义
    expect(unescapeLeadingHash('\\>foo')).toBe('\\>foo'); // 不动其它转义
  });

  it('buildDomTextCounts 应统计真实文本字符数（忽略语法字符）', async () => {
    const editor = await createEditor({
      root: container,
      defaultValue: '# Hello\n\nWorld',
    });

    const view = editor.getView();
    const markdown = editor.getMarkdown();
    const counts = buildDomTextCounts(view.state.doc, markdown);

    // 起点为 0，终点等于真实文本总长度（"Hello" + "World" = 10）
    expect(counts[0]).toBe(0);
    expect(counts[counts.length - 1]).toBe(10);
    // 单调递增
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1] ?? 0);
    }

    await editor.destroy();
  });

  it('markdownOffsetToDomTextOffset 应返回对应真实文本偏移', () => {
    const counts = [0, 0, 1, 2, 3, 3, 4, 5];
    expect(markdownOffsetToDomTextOffset(counts, 0)).toBe(0);
    expect(markdownOffsetToDomTextOffset(counts, 4)).toBe(3);
    expect(markdownOffsetToDomTextOffset(counts, 99)).toBe(5);
  });
});
