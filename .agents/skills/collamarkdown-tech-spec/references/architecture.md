# 架构参考：Y.Text 唯一真相

> 本文件是 `collamarkdown-tech-spec` 的深入内容（progressive disclosure）。先读 `SKILL.md` 的核心原则，再按需展开此处。

## 1. 唯一真相：Y.Text（Markdown 纯文本）

与早期「`y-prosemirror` 绑定 `Y.XmlFragment('prosemirror')`」方案不同，当前实现**不使用 ProseMirror 文档作为协同载体**：

- 每个文档对应一个 `Y.Doc`，协同内容存于 `Y.Doc.getText('content')`（一个 `Y.Text`）。
- `CollaFlowProvider.content` 即该 `Y.Text`。本地模式（`collab` 未配置）则用一个独立 `Y.Doc` 的 `Y.Text` 承载，行为一致。
- 源码区（Milkdown 所见即所得）与预览区共享这同一份 `Y.Text`；任何一方修改都落到 `Y.Text`，再驱动另一端重渲染。
- Markdown 解析/序列化基于 Milkdown `commonmark` + `@milkdown/preset-gfm`，支持表格、任务列表、脚注、删除线、自动链接。

```text
┌──────────────────────────── 应用层 (App) ────────────────────────────┐
│  createEditor() 暴露：content(Y.Text) / getView / getMarkdown /        │
│  setLocalSelection / getRemoteCursors / getAwarenessUsers             │
└───────────────────────────────────┬──────────────────────────────────┘
                                     │
┌───────────────────────────────────▼──────────────────────────────────┐
│                  @collaflow/markdown 包                                │
│  ┌──────────────┐   ┌──────────────────────┐   ┌──────────────────┐  │
│  │  editor/     │   │  collab/              │   │  editor/plugins/ │  │
│  │  Milkdown    │   │  provider(Y.Text)     │   │  highlight/      │  │
│  │  封装        │   │  yjs-binding          │   │  layout/theme/   │  │
│  │             │   │  cursor(相对位置)     │   │  awareness/      │  │
│  │             │   │                       │   │  cursor-map      │  │
│  └──────┬───────┘   └──────────┬───────────┘   └──────────────────┘  │
│         │ diffApply(Y.Text)    │ Y.Text 为唯一真相                    │
│         └─────────┬────────────┘                                     │
└───────────────────┼───────────────────────────────────────────────────┘
                    │ WebSocket（Hocuspocus 处理 0x00 Yjs update / 0x01 awareness）
┌───────────────────▼───────────────────────────────────────────────────┐
│            @collaflow/core（Hocuspocus 协同服务）                       │
│    托管 Y.Doc 与转发 Yjs update / Awareness，不感知内部文档结构          │
└────────────────────────────────────────────────────────────────────────┘
```

## 2. 双端绑定与防回环

`collab/yjs-binding.ts` 提供两个关键能力：

- **`createCollabPlugins(content: Y.Text): MilkdownPlugin`** —— 在 `InitReady` 后把 Milkdown 与 `Y.Text` 双向绑定：
  - `Y.Text` 变化（远端协同 / 源码区编辑）→ 触发 Milkdown 重新渲染；
  - Milkdown 编辑 → 序列化为 Markdown 写回 `Y.Text`（预览区改动也优先落到源码文本）。
- **`diffApply(yText, newText, origin)`** —— 以字符级 diff 把 `Y.Text` 对齐到目标文本，**不使用整体替换**，避免「整体替换式覆盖」丢失并发编辑。
- **transaction origin 防回环**：写回 `Y.Text` 时带 `origin`（`YJS_ORIGIN_MILKDOWN` 表示 Milkdown 回写，`YJS_ORIGIN_TEXTAREA` 表示源码区 textarea 回写），`observe` 端据此跳过自己引发的更新，杜绝回声循环。

> 注：`y-prosemirror` 仍是依赖，但**仅**在 `editor/plugins/awareness.ts` 中用于 `yCursorPlugin` 渲染远端光标 / 选区的 widget decoration；它**不参与文档绑定**。

## 3. 远程光标（双端叠层）

远端光标基于 `Y.Text` 的**相对位置**（记录「哪一项」而非「第几个字符」），因此并发插入导致下标漂移时仍能自愈，不会错位。

- `collab/cursor.ts`：
  - `encodeRelativePosition(yText, index)` → base64 字符串（存入 awareness）；
  - `decodeOffset(yText, encoded)` → 当前文档下的绝对字符偏移（位置被删除则返回 `null`）；
  - `decodeSelection(yText, selection)` → `{ anchor, head }` 或 `null`。
- `CollaFlowProvider.setLocalSelection(anchor, head)`：把本地选区（Y.Text 字符偏移）编码为相对位置写入 awareness。
- `CollaFlowProvider.getRemoteCursors()`：遍历 awareness，解码出远端光标（已换算为 Y.Text 绝对偏移），过滤掉无选区 / 无用户 / 无效者。

## 4. 预览区光标定位（cursor-map）

预览区是渲染后的富文本 DOM，而协同真相是 `Y.Text`（Markdown 纯文本）。要把「Markdown 第 o 个字符」定位到预览 DOM 中的真实坐标，需要 `editor/plugins/cursor-map.ts`：

- **`buildDomTextCounts(doc, markdown)`** —— 同步遍历 ProseMirror 文档与 Markdown 字符串，统计每个 Markdown 下标之前有多少「真实 DOM 文本字符」（去掉 `#` / `*` / 反引号 / 换行等语法字符）。返回 `counts[markdown.length + 1]`，`counts[i]` = `markdown[0..i)` 中的真实文本字符数。
- **`markdownOffsetToDomTextOffset(counts, offset)`** —— 把 Y.Text 偏移换算为「真实 DOM 文本偏移」。
- 配合在预览容器里按真实文本字符偏移定位 DOM 节点，用 `getBoundingClientRect` 即可算出远端光标坐标，无需把 Markdown 偏移映射到 ProseMirror 坐标（那更脆弱）。
- 已知近似：覆盖 commonmark 常见节点；自定义布局节点（Callout / Columns 等）按纯文本近似，光标可能略有偏差。

应用层（如 `packages/app` 的 `MarkdownEditor.tsx`）使用 `getDomTextOffset(container, node, offset)`（基于 `document.createRange` + `TreeWalker`）把预览区点击事件换算为 Y.Text 偏移，已修复空行点击选区错算到文末的问题。

## 5. 序列化转义约定

Milkdown 序列化 Markdown 时会在行首防御性转义 `#` / `>` / `*` 等（如 `#` → `\#`）。当前策略用 **`unescapeLeadingHash(markdown)`** 仅还原「行首的 `\#`」为 `#`，其余转义保留。该函数在 `onChange` 回调、`getMarkdown()` 返回值、以及 `diffApply` 写回 `Y.Text` 三处统一生效。

## 6. 数据流

### 6.1 本地编辑 → 唯一真相 → 另一端

```text
Milkdown 编辑
   ↓ 序列化 Markdown（listener 200ms 防抖）
unescapeLeadingHash(markdown)
   ↓
diffApply(Y.Text, text, YJS_ORIGIN_MILKDOWN)   # 字符级合并，带 origin
   ↓
Yjs Update → Hocuspocus → 广播给房间内其他用户
   ↓ observe（跳过自身 origin）
重新渲染 Milkdown / 更新预览
```

### 6.2 远端更新 → 本地

```text
WebSocket [0x00 + Yjs update]
   ↓ CollaFlowProvider 应用 update
Yjs 触发 document update
   ↓ observe（非自身 origin）
diffApply 反向驱动 Milkdown 重渲染
```

### 6.3 Awareness（光标 / 选区）

```text
本地选区变化（Y.Text 字符偏移）
   ↓ encodeRelativePosition → base64
awareness.setLocalStateField('selection', ...)
   ↓ Hocuspocus 自动封装 awareness 消息（0x01）
远端：decodeSelection → Y.Text 绝对偏移
   ↓ buildDomTextCounts + getBoundingClientRect
预览区渲染远端光标 widget（colla-cursor / colla-selection）
```

> Yjs sync 与 awareness 的传输封装（0x00 / 0x01）由 Hocuspocus 与 `@hocuspocus/provider` 完成，应用层无需手动分包。

## 7. 编辑器扩展模块与工具函数（非协同部分）

除协同 / 光标外，`@collaflow/markdown` 还提供一组**不触碰 `Y.Text` 真相**的编辑器能力与纯函数工具，全部以插件（`editor/plugins/*`）或工具模块（`src/utils/*`）形式存在，便于测试与复用：

### 7.1 编辑器插件（editor/plugins）

| 插件 | 入口 | 职责 |
|---|---|---|
| Mermaid | `createMermaidPlugin()` | ` ```mermaid ` 栅栏 → SVG |
| 数学公式 | `@milkdown/plugin-math` + `katex`（factory 接入） | 块/行内 KaTeX，DOM 为 `[data-type="math_block"/"math_inline"]` |
| 图片卡 | `imageCardPlugin` | `.colla-image-card`（缩略图 + 标题 + 链接） |
| 链接预览 | `createLinkPreviewPlugin()`（+ `LinkPreviewResolver`） | 解析并展示链接元数据 |
| 斜杠命令 | `createSlashCommandPlugin()` | `/` 唤起命令菜单 |
| 块把手 / 转换 | `blockHandlePlugin` + `createBlockHandleElement` + `buildConversionItems` | 左侧悬浮把手、块类型转换 |
| 高亮 / 布局 / 主题 / 任务列表 / 光标渲染 | 既有插件 | 见 §1 与 `conventions.md` 规则 3 |

### 7.2 工具函数（src/utils）

均为纯函数或浏览器侧 glue，不依赖协同运行时，可独立单测：

- `toc.ts`：`buildToc(doc) → TocItem[]`，从 ProseMirror 文档抽取标题层级。
- `front-matter.ts`：`parseFrontMatter(md) → FrontMatterResult` / `stringifyFrontMatter(data, body)`。
- `export.ts`：`buildStandaloneHtml(editor, opts)`（自包含 HTML，内联 `collectExportCss` 收集的样式）、`exportHtml` / `exportPdf`（浏览器打印）。
- `export-docx.ts`：`buildDocxDocument(editor, opts)` 遍历 `editor.getView().state.doc` 生成 `docx@^9` 文档；`exportDocx` 打包为 blob 下载。数学 / Mermaid 经 `html-to-image` 截图嵌入，失败时回退文本，详见 `status.md` 已知偏差。

> 这些模块共用 `editor.getView()` / `getHtml()` 读取渲染结果，但**只读不写** `Y.Text`，因此不改变「Y.Text 唯一真相」的协同语义。
