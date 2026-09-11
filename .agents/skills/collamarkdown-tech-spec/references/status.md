# 状态参考：实施阶段、已知偏差与待办

> 本文件是 `collamarkdown-tech-spec` 的深入内容，记录与代码同步的状态。

## 实施阶段

### Phase 1~4：基础编辑器 + 协同 + Awareness + 扩展插件 ✅ 已完成

1. ~~`createEditor()` 工厂，渲染标准 Markdown~~
2. ~~`listener` 插件支持 `onChange`~~
3. ~~`CollaFlowProvider`（Hocuspocus 客户端）~~
4. ~~Awareness 在线用户列表与远端光标 / 选区（`yCursorPlugin`）~~
5. ~~代码高亮（Prism）、Callout / Columns / Column / Card 自定义节点、主题 CSS 变量~~
6. ~~GFM 支持：表格、任务列表、脚注、删除线、自动链接~~

#### GFM 能力补充（v0.5.0）

- 接入 `@milkdown/preset-gfm`，统一提供表格、任务列表、脚注、删除线、自动链接的 schema 与输入规则。
- 新增 `editor/plugins/task-list.ts`：监听任务列表左侧 24px 热区点击，切换 `checked` 属性。
- 在 `notion-style.ts` 中扩展 GFM 样式，全部使用 `--cf-*` design tokens。
- 新增 `tests/gfm.test.ts`，148 项测试全部通过，覆盖率保持 100%。

### 架构重构（commit `0910e11`）：Y.Text 为唯一真相 ✅ 已完成

- 协同绑定由「`y-prosemirror` + `Y.XmlFragment`」改为「`Y.Text` + `diffApply` + transaction origin 防回环」。
- 新增预览区 / 源码区双端叠层远程光标（基于 Y.Text 相对位置）。
- 修复预览空行点击选区偏移错算到文末（`getDomTextOffset` 改用 Range 量化）。
- 修复行首 `#` 被序列化为 `\#`（`unescapeLeadingHash` 仅还原行首 `\#`）。
- 修正 `cursor-map` 对 `emphasis` / `inlineCode` / `hardbreak` 节点名的映射。
- 补充单测，markdown 包 58 项全过、覆盖率 100%。

#### GFM 能力补充（v0.5.0）

- 接入 `@milkdown/preset-gfm`。
- 新增任务列表点击切换插件 `editor/plugins/task-list.ts`。
- 扩展 Notion 风格 GFM 样式（`notion-style.ts`）。
- 新增 `tests/gfm.test.ts`，markdown 包测试增至 148 项，覆盖率 100%。

### 编辑器扩展插件阶段（v0.6.0）✅ 已完成

在保持 `Y.Text` 唯一真相与双端叠层光标不变的前提下，新增以下编辑器能力（均为独立插件 / 工具函数，核心保持干净）：

- **Mermaid**：新增 `editor/plugins/mermaid.ts`（`createMermaidPlugin`），把 ` ```mermaid ` 栅栏代码块渲染为 SVG；`notion-style.ts` 增加 `.colla-code-block--mermaid` / `.colla-mermaid` 样式。
- **数学公式（KaTeX）**：`factory.ts` 接入 `@milkdown/plugin-math` + `katex`，并 `import 'katex/dist/katex.min.css'`；块级 DOM 为 `[data-type="math_block"]`、行内为 `[data-type="math_inline"]`（非 `.katex-display`），序列化保留 `$...$` 与反斜杠转义。`notion-style.ts` 增加数学样式。
- **图片卡**：新增 `editor/plugins/image-card.ts`（`imageCardPlugin`），渲染 `.colla-image-card`（缩略图 + 标题 + 链接）。
- **链接预览**：新增 `editor/plugins/link-preview.ts`（`createLinkPreviewPlugin`），可注入 `LinkPreviewResolver` 解析元数据，类型 `LinkPreviewData` / `LinkPreviewResolver`。
- **斜杠命令**：新增 `editor/plugins/slash-command.ts`（`createSlashCommandPlugin`），`/` 唤起命令菜单。
- **块把手 / 拖拽 / 块转换**：新增 `editor/plugins/block-handle.ts`（`blockHandlePlugin` + `createBlockHandleElement` + `buildConversionItems`），左侧悬浮把手与块类型转换。

### 工具函数与导出阶段（v0.6.0）✅ 已完成

- **Front Matter**：`utils/front-matter.ts` 的 `parseFrontMatter` / `stringifyFrontMatter`（YAML 头解析 / 序列化）。
- **目录大纲**：`utils/toc.ts` 的 `buildToc` + `TocItem`，从文档抽取标题层级。
- **导出 HTML / PDF**：`utils/export.ts` 的 `buildStandaloneHtml`（纯函数，自包含 HTML）、`collectExportCss`（收集 `colla-md*` / `katex` / `colla-` 样式）、`exportHtml`（下载）、`exportPdf`（新窗口打印→另存为 PDF，矢量、与屏幕一致、无需后端）。
- **导出 Word（.docx）**：`utils/export-docx.ts` 的 `buildDocxDocument`（遍历 ProseMirror doc 树 → `docx@^9`）+ `exportDocx`（打包为 blob 下载）。覆盖：标题(1–6) / 段落(粗体·斜体·链接) / 引用(嵌套) / 代码(普通 + Mermaid→SVG 图片) / 列表(项目符号 + 有序，3 级编号) / GFM 表格(带对齐 shading) / 图片(内嵌或 `ExternalHyperlink` 回退) / 数学(块·行内 → `html-to-image` PNG 或 `$...$` 文本回退) / 分割线。

  > 实施细节：`extractText` 改用 `node.textContent` 而非 `textBetween`，规避后者在遍历自定义 / 原子节点时抛 `Cannot read properties of undefined (reading 'nodeSize')`；`tsup.config.ts` 用 `injectStyle: true + noExternal: ['katex']` 把 KaTeX JS+CSS 内联进 dist；数学 / Mermaid 图片通过 `html-to-image` 动态 import 截图，失败时回退文本，避免阻塞导出。

- **应用侧集成**：`packages/app/src/components/MarkdownEditor.tsx` 预览头新增「导出 HTML / 导出 PDF / 导出 Word」三按钮，`deriveTitle` 由 Front Matter 标题 → 首个 H1 → `"document"` 派生。

### Phase 5：版本对比 ❌ 未实现

- 尚未实现基于 Yjs snapshot 的 diff 与 `diffMarkdown(a, b)`。
- `src/diff/` 目录不存在；如需落地，按 conventions 规则 3 表末行以工具函数方式新增。

## 已知偏差 / 取舍

- **`cursor-map` 对自定义节点是纯文本近似**：覆盖 commonmark 常见节点；Callout / Columns 等自定义布局节点按纯文本处理，光标可能略有偏差。
- **`#` 单独仍渲染为空标题**：用户选择「最小修复」——仅还原行首 `\#` 转义，未改 Markdown 解析器。因此单独的 `#` 在预览区仍表现为空标题；符合标准 CommonMark 行为。若后续要「`#` 不算标题」，需改解析/渲染层（更大改动）。
- **`y-prosemirror` 依赖仍在**：仅用于 `awareness.ts` 的 `yCursorPlugin` 渲染，不参与文档绑定；不要据此误判为「文档绑定仍走 y-prosemirror」。
- **数学 / Mermaid 在 `.docx` 导出中是「截图嵌入」**：`buildDocxDocument` 用 `html-to-image` 把 KaTeX / Mermaid 的渲染 DOM 截成 PNG/SVG 嵌入；若截图失败（如无布局的测试环境），回退为 `$...$` 文本 / `FALLBACK_PNG`，不阻塞导出。要可编辑公式需后续接入 OMML（OMath）转换，当前未做。
- **KaTeX 样式依赖打包内联**：`tsup.config.ts` 用 `injectStyle: true + noExternal: ['katex']` 把 `katex/dist/katex.min.css` 内联进 dist；若改为外部 CSS 需同步调整应用侧引入。
- **导出 PDF 走浏览器打印**：`exportPdf` 打开新窗口 `print()`，依赖浏览器「另存为 PDF」；非服务端渲染，多端样式以 `@media print` + `collectExportCss` 收集的样式为准。

## 待办

- [x] **同步 `packages/markdown/TECH_SPEC.md`**：已更新至 v0.6.0，含 GFM / Mermaid / 数学 / 导出等实现细节。
- [x] **更新本 Skill（v0.6.0）**：manifest / SKILL / api / conventions / status / architecture 已同步新增能力（Mermaid / 数学 / 图片卡 / 链接预览 / 斜杠命令 / 块把手 / 目录 / Front Matter / 导出 HTML·PDF·Word）。
- [ ] 评估是否将本 Skill 标记为通用能力（连续两版评分 ≥ 90 且规则稳定后可设 `generic: true`）。当前评分为 90，再稳定一版 ≥90 方可标记。
- [ ] 如做 Phase 5 版本对比，补充 `src/diff/` 与对应单测，并保持 100% 覆盖率。
