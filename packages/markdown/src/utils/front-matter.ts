/**
 * Front Matter（YAML 头部）解析与序列化。
 *
 * 设计约束：本包的真相是 Y.Text（Markdown 纯文本），Front Matter 以 `---` 围栏存在于
 * 文本开头。为让 WYSIWYG 不把 `---` 渲染成 `<hr>`/乱码，编辑器加载时只取「正文」部分渲染，
 * 写回 Y.Text 时再把 Front Matter 重新拼回去（见 `collab/yjs-binding.ts`）。
 * 因此这里只负责纯文本的解析 / 序列化，不耦合编辑器。
 *
 * 支持：顶层 `key: value`、标量（字符串/数字/布尔/null）、引号字符串、内联数组 `[a, b]`、
 * 块数组（逐项 `- item`）。不支持嵌套映射与多文档（Front Matter 的典型用法已覆盖）。
 */

export interface FrontMatterResult {
  /** 是否识别到合法（含闭合 `---`）的 Front Matter */
  hasFrontMatter: boolean;
  /** 解析出的元数据（未识别时为 {}） */
  data: Record<string, unknown>;
  /** 正文（去掉 Front Matter 后的 Markdown） */
  body: string;
}

const FENCE = /^---\s*$/;
/** 行内注释字符（仅用于提示性说明，解析时不处理行内注释以保证稳健） */
const RESERVED_RE = /[:#[\]]/;

/** 解析单个标量值。 */
function parseScalar(raw: string): unknown {
  const s = raw.trim();
  if (s === '' || s === '~' || s === 'null') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  if (
    (s.startsWith('"') && s.endsWith('"') && s.length >= 2) ||
    (s.startsWith("'") && s.endsWith("'") && s.length >= 2)
  ) {
    return s.slice(1, -1);
  }
  if (s.startsWith('[') && s.endsWith(']')) {
    const inner = s.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(',').map((x) => parseScalar(x));
  }
  return s;
}

/** 解析 Front Matter 内的若干行（不含围栏本身）。 */
function parseYamlBlock(lines: string[]): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) {
      i++;
      continue;
    }
    const idx = line.indexOf(':');
    if (idx === -1) {
      i++;
      continue;
    }
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();

    if (value === '') {
      const next = lines[i + 1];
      if (next && /^\s*-\s+/.test(next)) {
        const arr: unknown[] = [];
        i++;
        while (i < lines.length && /^\s*-\s+/.test(lines[i]!)) {
          arr.push(parseScalar(lines[i]!.replace(/^\s*-\s+/, '')));
          i++;
        }
        data[key] = arr;
        continue;
      }
      data[key] = null;
      i++;
      continue;
    }

    data[key] = parseScalar(value);
    i++;
  }
  return data;
}

/**
 * 从 Markdown 文本中解析 Front Matter。
 *
 * 仅当文本以 `---` 开头且后续存在闭合 `---` 时才视为合法 Front Matter；
 * 否则原样返回（不污染正文）。
 */
export function parseFrontMatter(markdown: string): FrontMatterResult {
  const lines = markdown.split('\n');
  if (lines.length === 0 || !FENCE.test(lines[0] ?? '')) {
    return { hasFrontMatter: false, data: {}, body: markdown };
  }

  let closeIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (FENCE.test(lines[i] ?? '')) {
      closeIdx = i;
      break;
    }
  }
  if (closeIdx === -1) {
    return { hasFrontMatter: false, data: {}, body: markdown };
  }

  const data = parseYamlBlock(lines.slice(1, closeIdx));
  const body = lines.slice(closeIdx + 1).join('\n');
  return { hasFrontMatter: true, data, body: body.replace(/^\n/, '') };
}

/** 将单个标量序列化为 YAML 值文本。 */
function stringifyScalar(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  if (typeof value === 'string') {
    return RESERVED_RE.test(value) || value === '' ? `"${value}"` : value;
  }
  return JSON.stringify(value);
}

/**
 * 将元数据与正文重新序列化为带 Front Matter 的 Markdown。
 *
 * 数组以块数组（`key:\n  - a\n  - b`）形式输出，便于阅读。
 */
export function stringifyFrontMatter(data: Record<string, unknown>, body: string): string {
  const lines: string[] = ['---'];
  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) {
        lines.push(`  - ${stringifyScalar(item)}`);
      }
    } else {
      lines.push(`${key}: ${stringifyScalar(value)}`);
    }
  }
  lines.push('---');
  const front = lines.join('\n');
  return body ? `${front}\n\n${body}` : front;
}
