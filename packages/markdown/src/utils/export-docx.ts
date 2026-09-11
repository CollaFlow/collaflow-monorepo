/**
 * Word (.docx) 导出工具（基于 `docx` 库，纯前端、无需后端）。
 *
 * 设计要点：
 * - 直接遍历 ProseMirror 文档树（编辑器真相的结构化表示），把每个节点映射为原生 docx 元素，
 *   比「HTML → docx」更可控、跨浏览器更稳定（无 jsdom/Buffer polyfill 依赖）。
 * - 图片：抓取 `src` 并内联进 docx（fetch → ArrayBuffer），失败时退化为超链接。
 * - Mermaid：本身已是 SVG，直接内联 `<svg>`（稳定）。
 * - 数学公式（KaTeX）：用 `html-to-image` 把渲染后的 DOM 截图为 PNG 内联；
 *   截图失败（如离线/字体受限）时退化为 `$...$` / `$$...$$` 源码文本，保证不丢内容。
 * - 源码仍是源码：本工具只读预览区 DOM 与文档树，不影响 Y.Text 真相。
 */

import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type INumberingOptions,
  type ITableCellOptions,
} from 'docx';

import type { Node as PMNode } from 'prosemirror-model';
import type { EditorView } from 'prosemirror-view';

import type { CollaMarkdownEditor } from '../types';

export interface DocxExportOptions {
  /** 文档标题（用于 docx 内部 properties，不影响文件名） */
  title?: string;
}

type Run = TextRun | ExternalHyperlink;
type DocxChild = Paragraph | Table;
type LevelFormatValue = (typeof LevelFormat)[keyof typeof LevelFormat];

interface ConvertContext {
  view: EditorView;
  mathInlineEls: HTMLElement[];
  mathBlockEls: HTMLElement[];
  mermaidEls: SVGElement[];
  imageEls: HTMLImageElement[];
  quote?: boolean;
  listNumbering?: { reference: string; level: number };
}

// 1x1 透明 PNG，作为 SVG 图片在不支持环境下的回退
const FALLBACK_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const HEADING_LEVELS: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4,
  5: HeadingLevel.HEADING_5,
  6: HeadingLevel.HEADING_6,
};

function buildNumbering(): INumberingOptions {
  const makeLevels = (format: LevelFormatValue, text: string) =>
    [0, 1, 2].map((level) => ({
      level,
      format,
      text,
      alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 720 + level * 360, hanging: 360 } } },
    }));

  return {
    config: [
      { reference: 'colla-bullet', levels: makeLevels(LevelFormat.BULLET, '•') },
      { reference: 'colla-ordered', levels: makeLevels(LevelFormat.DECIMAL, '%1.') },
    ],
  };
}

async function fetchImageBuffer(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

function dataUrlToArrayBuffer(dataUrl: string): ArrayBuffer | null {
  const matched = dataUrl.match(/^data:.*?;base64,(.*)$/);
  const b64 = matched?.[1];
  if (!b64) return null;
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function mathToImageRun(el: HTMLElement): Promise<ImageRun | null> {
  try {
    const { toPng } = await import('html-to-image');
    const dataUrl = await toPng(el, { pixelRatio: 2, cacheBust: true });
    const buf = dataUrlToArrayBuffer(dataUrl);
    if (!buf) return null;
    const rect = el.getBoundingClientRect();
    const width = Math.max(40, Math.min(rect.width || 400, 560));
    const height = (rect.height || width * 0.4) * (width / (rect.width || width));
    return new ImageRun({ type: 'png' as const, data: buf, transformation: { width, height } });
  } catch {
    return null;
  }
}

function mermaidToImageRun(svg: SVGElement): ImageRun | null {
  const markup = svg.outerHTML;
  let width = 480;
  let height = 300;
  const viewBox = svg.getAttribute('viewBox');
  if (viewBox) {
    const parts = viewBox.split(/\s+/).map(Number);
    const w = parts[2];
    const h = parts[3];
    if (parts.length === 4 && typeof w === 'number' && w > 0 && typeof h === 'number') {
      width = Math.min(w, 560);
      height = (h * width) / w;
    }
  }
  try {
    const fallbackBuf = dataUrlToArrayBuffer(FALLBACK_PNG);
    if (!fallbackBuf) return null;
    return new ImageRun({
      type: 'svg' as const,
      data: markup,
      fallback: { type: 'png' as const, data: fallbackBuf },
      transformation: { width, height },
    });
  } catch {
    return null;
  }
}

function extractText(node: PMNode): string {
  if (!node) return '';
  // `textContent` concatenates all text nodes, separating block nodes with
  // newlines. Avoids `textBetween` which can throw on custom/atom children.
  return node.textContent ?? '';
}

function inlineToRuns(node: PMNode): Run[] {
  const marks = node.marks ?? [];
  const bold = marks.some((m) => m.type.name === 'strong');
  const italic = marks.some((m) => m.type.name === 'em');
  const code = marks.some((m) => m.type.name === 'code');
  const link = marks.find((m) => m.type.name === 'link');
  const run = new TextRun({
    text: node.text ?? '',
    bold,
    italics: italic,
    ...(code ? { font: 'Courier New', shading: { type: ShadingType.CLEAR, fill: 'F2F2F2' } } : {}),
  });
  if (link && typeof link.attrs?.href === 'string') {
    return [new ExternalHyperlink({ children: [run], link: link.attrs.href })];
  }
  return [run];
}

function collectInlineRuns(node: PMNode): Run[] {
  const runs: Run[] = [];
  node.forEach((child) => {
    if (child.isText) {
      runs.push(...inlineToRuns(child));
    } else if (child.type.name === 'hard_break') {
      runs.push(new TextRun({ text: '', break: 1 }));
    } else {
      runs.push(new TextRun(child.textContent ?? ''));
    }
  });
  return runs;
}

const quoteStyle = (quote?: boolean) =>
  quote
    ? {
        indent: { left: 360 },
        border: { left: { style: BorderStyle.SINGLE, size: 12, color: 'CCCCCC' } },
      }
    : {};

async function convertBlock(node: PMNode, ctx: ConvertContext, depth = 0): Promise<DocxChild[]> {
  switch (node.type.name) {
    case 'heading': {
      const level = (node.attrs.level as number) ?? 1;
      return [
        new Paragraph({
          heading: HEADING_LEVELS[level] ?? HeadingLevel.HEADING_1,
          children: collectInlineRuns(node),
          ...quoteStyle(ctx.quote),
          ...(ctx.listNumbering ? { numbering: ctx.listNumbering } : {}),
        }),
      ];
    }
    case 'paragraph': {
      return [
        new Paragraph({
          children: collectInlineRuns(node),
          ...quoteStyle(ctx.quote),
          ...(ctx.listNumbering ? { numbering: ctx.listNumbering } : {}),
        }),
      ];
    }
    case 'blockquote': {
      const prev = ctx.quote;
      ctx.quote = true;
      const inner = await convertChildren(node, ctx, depth);
      ctx.quote = prev;
      return inner;
    }
    case 'code_block': {
      // Mermaid：本身是 SVG，直接内联
      if (node.attrs.language === 'mermaid') {
        const svg = ctx.mermaidEls.shift();
        if (svg) {
          const run = mermaidToImageRun(svg);
          if (run) return [new Paragraph({ alignment: AlignmentType.CENTER, children: [run] })];
        }
        return [
          new Paragraph({
            children: [
              new TextRun({ text: '```mermaid\n' + extractText(node) + '\n```', font: 'Courier New' }),
            ],
          }),
        ];
      }
      const lines = extractText(node).split('\n');
      const runs = lines.map(
        (line, i) => new TextRun({ text: line, font: 'Courier New', break: i === 0 ? undefined : 1 }),
      );
      return [
        new Paragraph({
          shading: { type: ShadingType.CLEAR, fill: 'F6F5F4' },
          spacing: { before: 4, after: 4 },
          children: runs,
        }),
      ];
    }
    case 'bullet_list':
    case 'ordered_list': {
      const reference = node.type.name === 'bullet_list' ? 'colla-bullet' : 'colla-ordered';
      const items: PMNode[] = [];
      node.forEach((item) => items.push(item));
      const out: DocxChild[] = [];
      for (const item of items) {
        const prev = ctx.listNumbering;
        ctx.listNumbering = { reference, level: Math.min(depth, 2) };
        const blocks = await convertChildren(item, ctx, depth + 1);
        ctx.listNumbering = prev;
        out.push(...blocks);
      }
      return out;
    }
    case 'table': {
      const rowNodes: PMNode[] = [];
      node.forEach((row) => rowNodes.push(row));
      const rows: TableRow[] = [];
      for (const row of rowNodes) {
        const cellNodes: PMNode[] = [];
        row.forEach((cell) => cellNodes.push(cell));
        const cells: TableCell[] = [];
        for (const cell of cellNodes) {
          const children = await convertChildren(cell, ctx, depth);
          const cellOpts: ITableCellOptions = {
            width: {
              size: Math.floor(100 / Math.max(1, cellNodes.length)),
              type: WidthType.PERCENTAGE,
            },
            children,
          };
          cells.push(new TableCell(cellOpts));
        }
        rows.push(new TableRow({ children: cells }));
      }
      return [new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows })];
    }
    case 'image': {
      const src = node.attrs.src as string | undefined;
      const alt = (node.attrs.alt as string | undefined) ?? '';
      if (src) {
        const buf = await fetchImageBuffer(src);
        if (buf) {
          const imgEl = ctx.imageEls.shift();
          const natW = imgEl?.naturalWidth ?? 0;
          const natH = imgEl?.naturalHeight ?? 0;
          const width = Math.min(natW || 480, 480);
          const height = natH && natW ? (natH * width) / natW : Math.round(width * 0.66);
          return [
            new Paragraph({
              children: [
                new ImageRun({ type: 'png' as const, data: buf, transformation: { width, height } }),
              ],
            }),
          ];
        }
        const label = alt ? `${alt}（${src}）` : src;
        return [
          new Paragraph({
            children: [new ExternalHyperlink({ children: [new TextRun(label)], link: src })],
          }),
        ];
      }
      return [];
    }
    case 'math_inline': {
      const el = ctx.mathInlineEls.shift();
      if (el) {
        const run = await mathToImageRun(el);
        if (run) return [new Paragraph({ children: [run] })];
      }
      return [new Paragraph({ children: [new TextRun({ text: `$${extractText(node)}$`, italics: true })] })];
    }
    case 'math_block': {
      const el = ctx.mathBlockEls.shift();
      if (el) {
        const run = await mathToImageRun(el);
        if (run) return [new Paragraph({ alignment: AlignmentType.CENTER, children: [run] })];
      }
      return [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: `$$${extractText(node)}$$`, italics: true })],
        }),
      ];
    }
    case 'horizontal_rule':
      return [
        new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'DDDDDD' } },
          children: [new TextRun('')],
        }),
      ];
    default:
      // 未知节点（callout / columns 等）：退化为纯文本，保证内容不丢
      return [new Paragraph({ children: [new TextRun(extractText(node))] })];
  }
}

async function convertChildren(node: PMNode, ctx: ConvertContext, depth = 0): Promise<DocxChild[]> {
  const children: PMNode[] = [];
  node.forEach((child) => children.push(child));
  const out: DocxChild[] = [];
  for (const child of children) {
    out.push(...(await convertBlock(child, ctx, depth)));
  }
  return out;
}

/**
 * 把编辑器当前内容构建为 docx `Document` 对象（异步：图片/公式需抓取或截图）。
 */
export async function buildDocxDocument(
  editor: CollaMarkdownEditor,
  opts: DocxExportOptions = {},
): Promise<Document> {
  const view = editor.getView();
  const dom = view.dom as HTMLElement;
  const ctx: ConvertContext = {
    view,
    mathInlineEls: Array.from(dom.querySelectorAll('[data-type="math_inline"]')) as HTMLElement[],
    mathBlockEls: Array.from(dom.querySelectorAll('[data-type="math_block"]')) as HTMLElement[],
    mermaidEls: Array.from(dom.querySelectorAll('.colla-mermaid svg')) as SVGElement[],
    imageEls: Array.from(dom.querySelectorAll('img')) as HTMLImageElement[],
  };

  const children = await convertChildren(view.state.doc, ctx);

  return new Document({
    title: opts.title ?? 'Document',
    numbering: buildNumbering(),
    sections: [{ children }],
  });
}

/**
 * 构建 docx 并触发浏览器下载（`.docx`）。
 */
export async function exportDocx(
  editor: CollaMarkdownEditor,
  opts: DocxExportOptions & { filename?: string } = {},
): Promise<void> {
  const doc = await buildDocxDocument(editor, opts);
  const blob = await Packer.toBlob(doc);
  if (typeof document === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitize(opts.filename ?? opts.title ?? 'document')}.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function sanitize(input: string): string {
  return input
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80) || 'document';
}
