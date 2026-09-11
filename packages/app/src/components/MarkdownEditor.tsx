'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { InputEvent, MouseEvent } from 'react';
import type { CollaMarkdownEditor, FrontMatterResult, RemoteCursor, TocItem } from '@collaflow/markdown';
import {
  buildDomTextCounts,
  buildToc,
  collectExportCss,
  diffApply,
  exportDocx,
  exportHtml,
  exportPdf,
  markdownOffsetToDomTextOffset,
  parseFrontMatter,
  YJS_ORIGIN_TEXTAREA,
} from '@collaflow/markdown';

interface MarkdownEditorProps {
  /** 协同房间 ID；为空时不启用协同（纯本地编辑） */
  roomId?: string;
  /** CollaFlow Core（Hocuspocus）WebSocket 地址 */
  serverUrl?: string;
  /** 初始 Markdown 内容 */
  defaultValue?: string;
}

const DEFAULT_CONTENT = '# Hello CollaFlow\n\n开始编辑，支持 **Markdown** 与协同光标。';

interface RenderedCursor {
  id: number;
  top: number;
  left: number;
  height: number;
  color: string;
  name: string;
}

/* ----------------------------- 坐标辅助函数 ----------------------------- */

/** 计算 textarea 中指定字符位置的屏幕坐标（mirror-div 技术）。 */
function getCaretCoordinates(
  el: HTMLTextAreaElement,
  position: number
): { top: number; left: number; height: number } {
  const div = document.createElement('div');
  const style = window.getComputedStyle(el);
  const props = [
    'boxSizing', 'width', 'height', 'overflowX', 'overflowY',
    'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
    'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'fontStyle', 'fontVariant', 'fontWeight', 'fontStretch', 'fontSize',
    'lineHeight', 'fontFamily', 'textAlign', 'textTransform', 'textIndent',
    'letterSpacing', 'wordSpacing', 'tabSize', 'whiteSpace', 'wordWrap',
  ] as const;
  props.forEach((p) => {
    const value = (style as unknown as Record<string, string>)[p] ?? '';
    (div.style as unknown as Record<string, string>)[p] = value;
  });
  div.style.position = 'absolute';
  div.style.visibility = 'hidden';
  div.style.whiteSpace = 'pre-wrap';
  div.style.wordWrap = 'break-word';
  div.textContent = el.value.substring(0, position);
  const span = document.createElement('span');
  span.textContent = el.value.substring(position) || '.';
  div.appendChild(span);
  document.body.appendChild(div);
  const coords = {
    top: span.offsetTop + parseInt(style.borderTopWidth || '0', 10),
    left: span.offsetLeft + parseInt(style.borderLeftWidth || '0', 10),
    height: parseInt(style.lineHeight || '0', 10) || span.offsetHeight,
  };
  document.body.removeChild(div);
  return coords;
}

/** 统计 container 内、指定 DOM 位置之前的「真实文本字符数」。 */
function getDomTextOffset(container: HTMLElement, node: Node, offset: number): number {
  // 空行 / <br> 等场景下 domAtPos 返回的是「元素节点」而非文本节点，
  // 仅遍历文本节点会匹配不到、把偏移错算到文末。这里改用 Range 量化从容器起点到目标位置，
  // 元素节点也能正确得到其之前的真实文本长度。
  const range = document.createRange();
  range.setStart(container, 0);
  try {
    range.setEnd(node, offset);
  } catch {
    return 0;
  }
  const frag = range.cloneContents();
  let count = 0;
  const walker = document.createTreeWalker(frag, NodeFilter.SHOW_TEXT);
  let n = walker.nextNode();
  while (n) {
    count += (n.textContent ?? '').length;
    n = walker.nextNode();
  }
  return count;
}

/** 在 container 中找到第 target 个「真实文本字符」处的屏幕坐标。 */
function domPosAtTextOffset(
  container: HTMLElement,
  target: number
): { top: number; left: number; height: number } | null {
  let count = 0;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let last: Text | null = null;
  let lastLen = 0;
  let n = walker.nextNode() as Text | null;
  while (n) {
    const len = (n.textContent ?? '').length;
    if (count + len >= target) {
      const pos = Math.max(0, Math.min(target - count, len));
      const range = document.createRange();
      range.setStart(n, pos);
      range.collapse(true);
      const rect = range.getBoundingClientRect();
      return { top: rect.top, left: rect.left, height: rect.height };
    }
    count += len;
    last = n;
    lastLen = len;
    n = walker.nextNode() as Text | null;
  }
  if (last) {
    const range = document.createRange();
    range.setStart(last, lastLen);
    range.collapse(true);
    const rect = range.getBoundingClientRect();
    return { top: rect.top, left: rect.left, height: rect.height };
  }
  return null;
}

/** 由「真实文本字符偏移」反查 Markdown 字符偏移（closest match）。 */
function domTextOffsetToMdOffset(counts: number[], domOffset: number): number {
  let best = 0;
  let bestDiff = Number.POSITIVE_INFINITY;
  for (let i = 0; i < counts.length; i++) {
    const diff = Math.abs((counts[i] ?? 0) - domOffset);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  return best;
}

/* ------------------------------- 组件 ------------------------------- */

function RemoteCaret({ top, left, height, color, name }: RenderedCursor) {
  return (
    <>
      <div className="colla-rc-cursor" style={{ top, left, height, background: color }} />
      <div className="colla-rc-label" style={{ top, left, background: color }}>
        {name}
      </div>
    </>
  );
}

/** 将 Front Matter 值格式化为可展示的纯文本。 */
function formatFmValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map((v) => String(v)).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function MarkdownEditor({
  roomId,
  serverUrl,
  defaultValue = DEFAULT_CONTENT,
}: MarkdownEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previewWrapRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const sourceWrapRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const contentRef = useRef<CollaMarkdownEditor['content'] | null>(null);
  const editorRef = useRef<CollaMarkdownEditor | null>(null);
  const countsRef = useRef<number[]>([]);

  const [leftWidth, setLeftWidth] = useState(50);
  const [isResizing, setIsResizing] = useState(false);
  const [remoteCursors, setRemoteCursors] = useState<RemoteCursor[]>([]);
  const [version, setVersion] = useState(0);
  const [textCursors, setTextCursors] = useState<RenderedCursor[]>([]);
  const [previewCursors, setPreviewCursors] = useState<RenderedCursor[]>([]);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [frontMatter, setFrontMatter] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    let cancelled = false;
    let editor: CollaMarkdownEditor | null = null;
    let cleanupPreview: (() => void) | null = null;
    let editorCleanup: (() => void) | null = null;

    void (async () => {
      const { createEditor } = await import('@collaflow/markdown');
      if (cancelled || !previewRef.current) return;

      editor = await createEditor({
        root: previewRef.current,
        defaultValue,
        highlight: true,
        theme: 'light',
        collab:
          roomId && serverUrl
            ? { roomId, serverUrl, user: { name: 'You', color: '#3b82f6' } }
            : undefined,
        onAwarenessChange: () => {
          setRemoteCursors(editorRef.current?.getRemoteCursors() ?? []);
        },
      });
      editorRef.current = editor;

      const content = editor.content;
      contentRef.current = content;

      if (textareaRef.current) {
        textareaRef.current.value = content.toString();
      }

      // content 变化（远端协同 / 预览区编辑）→ 同步回 textarea + 触发光标重算
      const observer = (_: unknown, transaction: { origin: unknown }) => {
        if (transaction.origin === YJS_ORIGIN_TEXTAREA) {
          setVersion((v) => v + 1);
          return;
        }
        syncTextareaFromContent();
        recomputePreviewCounts();
        setVersion((v) => v + 1);
      };
      content.observe(observer);

      // 预览区本地选区 → 广播
      const view = editor.getView();
      const onPreviewSelection = () => {
        const { from, to } = view.state.selection;
        const a = getDomTextOffset(view.dom, view.domAtPos(from).node, view.domAtPos(from).offset);
        const b = getDomTextOffset(view.dom, view.domAtPos(to).node, view.domAtPos(to).offset);
        editor?.setLocalSelection(
          domTextOffsetToMdOffset(countsRef.current, a),
          domTextOffsetToMdOffset(countsRef.current, b)
        );
      };
      view.dom.addEventListener('keyup', onPreviewSelection);
      view.dom.addEventListener('mouseup', onPreviewSelection);
      view.dom.addEventListener('focus', onPreviewSelection);
      cleanupPreview = () => {
        view.dom.removeEventListener('keyup', onPreviewSelection);
        view.dom.removeEventListener('mouseup', onPreviewSelection);
        view.dom.removeEventListener('focus', onPreviewSelection);
      };

      recomputePreviewCounts();
      setRemoteCursors(editor.getRemoteCursors());

      editorCleanup = () => content.unobserve(observer);
    })();

    return () => {
      cancelled = true;
      cleanupPreview?.();
      editorCleanup?.();
      contentRef.current = null;
      void editorRef.current?.destroy();
      editorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, serverUrl, defaultValue]);

  /** 命令式把 content 同步到 textarea（保留光标）。 */
  const syncTextareaFromContent = useCallback(() => {
    const ta = textareaRef.current;
    const content = contentRef.current;
    if (!ta || !content) return;

    const next = content.toString();
    if (ta.value === next) return;

    const prev = ta.value;
    const selStart = ta.selectionStart;
    let i = 0;
    const min = Math.min(prev.length, next.length);
    while (i < min && prev[i] === next[i]) i++;
    const delta = next.length - prev.length;

    ta.value = next;
    if (document.activeElement === ta) {
      const newPos = Math.max(i, Math.min(next.length, selStart + (selStart <= i ? 0 : delta)));
      ta.setSelectionRange(newPos, newPos);
    }
  }, []);

  /** 重新计算预览区「Markdown 偏移 → 真实文本偏移」映射，并同步目录大纲与 Front Matter。 */
  const recomputePreviewCounts = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const view = editor.getView();
    const md = editor.getMarkdown();
    countsRef.current = buildDomTextCounts(view.state.doc, md);
    setToc(buildToc(md));

    const content = contentRef.current;
    if (content) {
      const fm: FrontMatterResult = parseFrontMatter(content.toString());
      setFrontMatter(fm.hasFrontMatter ? fm.data : null);
    }
  }, []);

  /** 点击目录项 → 平滑滚动到对应标题（按文档顺序与渲染标题一一对应）。 */
  const scrollToHeading = useCallback((index: number) => {
    const editor = editorRef.current;
    if (!editor) return;
    const view = editor.getView();
    const headings = view.dom.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const el = headings[index] as HTMLElement | undefined;
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  /** 推断导出文件名/标题：Front Matter title > 首个 H1 > 默认 */
  const deriveTitle = useCallback((): string => {
    if (frontMatter && typeof frontMatter.title === 'string' && frontMatter.title) {
      return frontMatter.title;
    }
    const h1 = editorRef.current?.getView().dom.querySelector('h1');
    return (h1?.textContent?.trim() || 'document') as string;
  }, [frontMatter]);

  /** 导出为独立 HTML 文件 */
  const handleExportHtml = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    exportHtml({ title: deriveTitle(), bodyHtml: editor.getHtml(), css: collectExportCss() });
  }, [deriveTitle]);

  /** 导出为 PDF（新窗口打印 → 另存为 PDF） */
  const handleExportPdf = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    exportPdf({ title: deriveTitle(), bodyHtml: editor.getHtml(), css: collectExportCss() });
  }, [deriveTitle]);

  /** 导出为 Word (.docx) */
  const handleExportDocx = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    void exportDocx(editor, { title: deriveTitle() });
  }, [deriveTitle]);

  // 编辑源码 → 最小字符差异写入 content（本地输入，光标稳定）
  const handleSourceInput = useCallback((e: InputEvent<HTMLTextAreaElement>) => {
    const content = contentRef.current;
    if (!content) return;
    diffApply(content, e.currentTarget.value, YJS_ORIGIN_TEXTAREA);
  }, []);

  // 源码区本地选区 → 广播
  const handleSourceSelection = useCallback(() => {
    const ta = textareaRef.current;
    const editor = editorRef.current;
    if (!ta || !editor) return;
    editor.setLocalSelection(ta.selectionStart, ta.selectionEnd);
  }, []);

  // 拖拽分隔条调整左右宽度
  const startResize = useCallback((e: MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    setIsResizing(true);

    const onMove = (ev: globalThis.MouseEvent) => {
      const rect = container.getBoundingClientRect();
      if (rect.width === 0) return;
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      setLeftWidth(Math.min(80, Math.max(20, pct)));
    };
    const onUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  // 远端光标坐标：随 content / remoteCursors 变化重算
  useLayoutEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      setTextCursors(
        remoteCursors.map((c) => {
          const coords = getCaretCoordinates(ta, c.anchor);
          return {
            id: c.clientId,
            top: coords.top - ta.scrollTop,
            left: coords.left - ta.scrollLeft,
            height: coords.height,
            color: c.user.color,
            name: c.user.name,
          };
        })
      );
    }

    const pWrap = previewWrapRef.current;
    const editor = editorRef.current;
    if (pWrap && editor) {
      const view = editor.getView();
      const wrapRect = pWrap.getBoundingClientRect();
      setPreviewCursors(
        remoteCursors.map((c) => {
          const domOffset = markdownOffsetToDomTextOffset(countsRef.current, c.anchor);
          const rect = domPosAtTextOffset(view.dom, domOffset);
          if (!rect) return null;
          return {
            id: c.clientId,
            top: rect.top - wrapRect.top,
            left: rect.left - wrapRect.left,
            height: rect.height,
            color: c.user.color,
            name: c.user.name,
          };
        }).filter((c): c is RenderedCursor => c !== null)
      );
    }
  }, [remoteCursors, version]);

  return (
    <div
      className={`flex w-full overflow-hidden rounded-lg border border-border bg-card ${
        isResizing ? 'select-none' : ''
      }`}
      style={{ height: '70vh', minHeight: '420px' }}
    >
      {/* 目录大纲 */}
      <aside className="flex h-full w-56 shrink-0 flex-col overflow-hidden border-r border-border bg-card">
        <div className="border-b border-border px-3 py-1.5 text-xs text-muted-foreground">
          目录
        </div>
        <nav className="h-full flex-1 overflow-auto p-2">
          {toc.length === 0 ? (
            <p className="px-2 py-1 text-xs text-muted-foreground">暂无标题</p>
          ) : (
            toc.map((item, i) => (
              <button
                key={`${item.offset}-${i}`}
                type="button"
                onClick={() => scrollToHeading(i)}
                title={item.title}
                className="block w-full truncate rounded px-2 py-1 text-left text-sm text-foreground transition-colors hover:bg-muted"
                style={{ paddingLeft: `${8 + (item.level - 1) * 12}px` }}
              >
                {item.title || '(空标题)'}
              </button>
            ))
          )}
        </nav>
      </aside>

      {/* 预览（WYSIWYG） + 源码（Markdown）分栏 */}
      <div ref={containerRef} className="flex h-full min-w-0 flex-1 overflow-hidden">
        {/* 预览 */}
        <section
          className="flex h-full flex-col overflow-hidden"
          style={{ width: `${leftWidth}%` }}
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-1.5 text-xs text-muted-foreground">
            <span>预览</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleExportHtml}
                className="rounded px-2 py-0.5 text-foreground transition-colors hover:bg-muted"
                title="导出为独立 HTML 文件"
              >
                导出 HTML
              </button>
              <button
                type="button"
                onClick={handleExportPdf}
                className="rounded px-2 py-0.5 text-foreground transition-colors hover:bg-muted"
                title="打印 / 另存为 PDF"
              >
                导出 PDF
              </button>
              <button
                type="button"
                onClick={handleExportDocx}
                className="rounded px-2 py-0.5 text-foreground transition-colors hover:bg-muted"
                title="导出为 Word (.docx)"
              >
                导出 Word
              </button>
            </div>
          </div>
          {frontMatter && (
            <div className="border-b border-border bg-card px-3 py-2 text-sm">
              <div className="mb-1 text-xs text-muted-foreground">属性</div>
              {Object.entries(frontMatter).map(([key, value]) => (
                <div key={key} className="flex gap-2 py-0.5">
                  <span className="w-28 shrink-0 truncate text-muted-foreground" title={key}>
                    {key}
                  </span>
                  <span className="min-w-0 flex-1 truncate" title={formatFmValue(value)}>
                    {formatFmValue(value)}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div ref={previewWrapRef} className="relative h-full flex-1 overflow-hidden">
            <div ref={previewRef} className="colla-editor h-full w-full overflow-auto p-4" />
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              {previewCursors.map((c) => (
                <RemoteCaret key={c.id} {...c} />
              ))}
            </div>
          </div>
        </section>

        {/* 拖拽分隔条 */}
        <div
          onMouseDown={startResize}
          role="separator"
          aria-orientation="vertical"
          className="w-1.5 shrink-0 cursor-col-resize bg-border transition-colors hover:bg-accent"
        />

        {/* 源码（可编辑 Markdown，非受控） */}
        <section
          className="flex h-full flex-col overflow-hidden"
          style={{ width: `${100 - leftWidth}%` }}
        >
          <div className="border-b border-border px-3 py-1.5 text-xs text-muted-foreground">
            源码（Markdown）
          </div>
          <div ref={sourceWrapRef} className="relative h-full flex-1 overflow-hidden">
            <textarea
              ref={textareaRef}
              defaultValue={defaultValue}
              onInput={handleSourceInput}
              onKeyUp={handleSourceSelection}
              onMouseUp={handleSourceSelection}
              onSelect={handleSourceSelection}
              spellCheck={false}
              placeholder="在此编辑 Markdown 源码…"
              className="h-full w-full flex-1 resize-none bg-transparent p-4 font-mono text-sm leading-relaxed text-foreground outline-none"
            />
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              {textCursors.map((c) => (
                <RemoteCaret key={c.id} {...c} />
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
