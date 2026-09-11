---
name: collamarkdown-tech-spec
description: 协作文档编辑器（@collaflow/markdown）技术方案 Skill：以 Y.Text 为唯一真相的 Milkdown + Yjs + Hocuspocus 协作文档架构。用于实现/重构 markdown 包、扩展协同/双端远程光标/GFM/高亮/布局分区、或定义其与 core 的集成边界；不适用于服务端持久化与房间管理，以及纯前端非协同富文本需求。
version: 0.6.0
owner: collaflow-core-team
status: active
---

# @collaflow/markdown 技术方案

> 本 Skill 定义 `@collaflow/markdown` 协作文档编辑器的技术选型、架构原则与实现规范。
> 核心：**以 Markdown 文本（`Y.Text`）为唯一真相**，源码区（Milkdown WYSIWYG）与预览区共享同一份文本，协同只同步这一份 `Y.Text`。

## 触发条件

触发条件为以下任一场景（适用 / 什么时候用）：

- 实现 / 重构 `@collaflow/markdown` 包
- 评估协作文档编辑器选型（Markdown / WYSIWYG / 协同）
- 为 markdown 包加功能：GFM、高亮、布局分区、主题、远程光标、选区映射、版本对比
- 定义 `@collaflow/markdown` 与 `@collaflow/core` 的集成边界
- 处理预览区 / 源码区光标定位、`Y.Text` 绑定相关问题

不适用场景（什么时候不用，交给别处）：

- 服务端持久化、房间生命周期、Yjs 更新历史存储 → 属 `@collaflow/core`（Hocuspocus 服务）
- 非协同的纯前端富文本需求 → 本 Skill 的协同 / 光标部分不适用，仅参考其 Milkdown 封装思路
- Yjs / Hocuspocus 协议、重连、心跳 → 由 `@hocuspocus/provider` 与 `@collaflow/core` 负责
- 任何含密钥 / 内网地址 / 个人隐私的场景 → 禁止（见禁止事项）

## 规则

规则说明如下（通用原则，不绑定项目名词；本仓库具体文件 / 接口 / 目录见 `references/`）：

### 规则 1：唯一真相用可 CRDT 合并的线性文本

协同编辑器的共享载体应是 `Y.Text` 这类线性结构，而非富文本文档树（`Y.XmlFragment`）。多人编辑按字符级合并，避免「整体替换式覆盖」。

### 规则 2：避免回环用 origin

写回真相时带 transaction origin 并据此跳过自身引发的 observe，杜绝回声循环；用字符级 diff 而非整体替换。

### 规则 3：远端光标用相对位置

编码为「第几项」而非「第几个字符」，并发插入导致下标漂移时仍可自愈，不会错位。

### 规则 4：双端共享同一真相

源码区与预览区读写同一份文本；光标从真相偏移映射到「真实 DOM 文本偏移」定位，而非解析序列化格式（更脆弱）。

### 规则 5：扩展一律插件化

所有自定义能力封装为编辑器插件 / 节点 / mark，保持核心干净。

### 规则 6：传输交给基础设施

协同传输（WebSocket / awareness 协议）交给 Hocuspocus，客户端只收口生命周期与本地状态。

## 已实现能力清单（v0.6.0）

下表为 `@collaflow/markdown` 已落地的能力与实现入口（以 `references/api.md` / `conventions.md` 的包结构为准）：

| 能力 | 实现入口 | 说明 |
|---|---|---|
| 基础编辑器 / 协同 / 远程光标 | `createEditor`（`editor/factory.ts`）+ `CollaFlowProvider`（`collab/`） | Y.Text 唯一真相，见 `references/architecture.md` |
| 代码高亮 / GFM / 布局 / 主题 | `editor/plugins/*` | 高亮、表格/任务/脚注、Callout/Columns、主题变量 |
| Mermaid 渲染 | `createMermaidPlugin()`（`editor/plugins/mermaid.ts`） | ` ```mermaid ` 栅栏 → SVG，CSS 走 `notion-style.ts` |
| 数学公式（KaTeX） | `@milkdown/plugin-math` + `katex`（`factory.ts` 接入） | 块/行内，DOM 为 `[data-type="math_block"/"math_inline"]`，序列化保留 `$...$` 与反斜杠转义 |
| 图片卡 | `imageCardPlugin`（`editor/plugins/image-card.ts`） | 缩略图 + 标题 + 链接，`.colla-image-card` |
| 链接预览 | `createLinkPreviewPlugin()`（`editor/plugins/link-preview.ts`） | 可注入 `LinkPreviewResolver` 解析元数据 |
| 斜杠命令 | `createSlashCommandPlugin()`（`editor/plugins/slash-command.ts`） | `/` 唤起命令菜单 |
| 块把手 / 拖拽 / 块转换 | `blockHandlePlugin` + `createBlockHandleElement` + `buildConversionItems`（`editor/plugins/block-handle.ts`） | 左侧悬浮把手、块类型转换 |
| Front Matter | `parseFrontMatter` / `stringifyFrontMatter`（`utils/front-matter.ts`） | YAML 头解析 / 序列化 |
| 目录大纲 | `buildToc` + `TocItem`（`utils/toc.ts`） | 从文档抽取标题层级 |
| 导出 HTML / PDF | `buildStandaloneHtml` / `exportHtml` / `exportPdf`（`utils/export.ts`） | 自包含 HTML；PDF 走浏览器打印 |
| 导出 Word（.docx） | `buildDocxDocument` / `exportDocx`（`utils/export-docx.ts`，`docx@^9`） | 遍历 ProseMirror doc 树→docx，覆盖标题/段落/引用/代码+Mermaid/列表/表格/图片/数学/分割线 |

> 应用侧集成见 `packages/app/src/components/MarkdownEditor.tsx`：预览头提供「导出 HTML / 导出 PDF / 导出 Word」三按钮，标题由 Front Matter → 首个 H1 → "document" 派生。

## 示例

示例如下：

### 示例 1：基础编辑器

```ts
import { createEditor } from '@collaflow/markdown';

const editor = await createEditor({
  root: document.getElementById('editor')!,
  defaultValue: '# Hello\n\n```js\nconst x = 1;\n```',
  highlight: true,
  theme: 'light',
  onChange: (markdown) => console.log(markdown),
});
```

### 示例 2：接入协同 + 远程光标

```ts
const editor = await createEditor({
  root: document.getElementById('editor')!,
  collab: { roomId: 'doc-1', serverUrl: 'ws://localhost:1234', user: { name: 'Alice', color: '#ff6b6b' } },
  onAwarenessChange: (users) => console.log('在线用户:', users),
});
editor.setLocalSelection(0, 5);          // 上报本地选区（Y.Text 偏移）
console.log(editor.getRemoteCursors());  // 读取远端光标（已解码为 Y.Text 偏移）
```

> 完整接口（Markdown 编辑器实例 / `CollaFlowProvider` / 光标工具）见 `references/api.md`。

## 实施步骤

1. 读 `references/architecture.md` 理解 `Y.Text` 架构与数据流。
2. 改 API / 接口时核对 `references/api.md`。
3. 加功能 / 建模块遵循 `references/conventions.md` 的规则与禁止事项。
4. 完成后运行 `pnpm skills:validate` 确认评分 ≥ 80。

## 禁止事项

- 不要引入与 Milkdown / ProseMirror 定位重叠的富文本编辑器（Quill、Draft.js、Slate、TipTap）。
- 不要把协同载体从 `Y.Text` 改回 `Y.XmlFragment` / ProseMirror 文档绑定（除非有明确需求并经评审）。
- 不要对 `Y.Text` 做整体替换式写回；必须用 `diffApply` + transaction origin 防回环。
- 不要把服务端逻辑（文档持久化、房间管理）下沉到 `@collaflow/markdown`。
- 不要把密钥、内网地址、个人隐私数据写入 Skill 或代码注释。
- 不要为了凑覆盖率在 `src/` 里留空占位文件。

> 完整禁止清单与工具链要求见 `references/conventions.md`。

## 参考

- `references/architecture.md` — Y.Text 唯一真相架构、双端绑定、远程光标、cursor-map
- `references/api.md` — 公共 API 接口（Markdown 编辑器实例 / CollaFlowProvider / 光标工具）
- `references/conventions.md` — 规则细节、禁止事项、工具链与 100% 覆盖率要求
- `references/status.md` — 实施阶段状态、已知偏差、待办
- `packages/markdown/src/` — 当前实现（以本 Skill + references 为准）
- `packages/markdown/TECH_SPEC.md` — 详细文档（已同步至 v0.6.0 能力集）
- `.agents/SKILL.md` — CollaFlow Skill 管理规范
