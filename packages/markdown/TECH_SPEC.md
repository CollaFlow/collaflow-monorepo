# CollaMarkdown 技术方案

> 版本：0.5.0
> 状态：已实现（与 `@collaflow/markdown` 当前代码一致）
> 目标：在 CollaFlow 协同基础设施之上，构建基于 Milkdown + ProseMirror + Yjs（**以 `Y.Text` 为唯一真相**）+ Hocuspocus 的协作文档能力。

---

## 1. 目标与范围

### 1.1 目标

- 提供标准 Markdown 输入/输出的所见即所得编辑器。
- 复用 CollaFlow Core（`@collaflow/core`）基于 Hocuspocus 的 Yjs 协同通道，实现多人实时协同编辑。
- 支持代码块语法高亮、GFM（表格 / 任务列表 / 脚注 / 删除线 / 自动链接）、文本高亮、自定义布局节点（Callout / 分栏 / 卡片）。
- 提供预览区 / 源码区双端叠层远程光标。
- 保持包内分层清晰，所有扩展通过 Milkdown 插件实现。

### 1.2 范围

| 在范围内 | 不在范围内（后续迭代） |
|---|---|
| 客户端编辑器核心与插件 | 服务端持久化存储策略 |
| 与 CollaFlow Core（`@collaflow/core`）的 Yjs / Awareness 集成 | 富文本格式导入导出（Word/PDF） |
| 代码高亮、文本高亮、Callout 节点 | 表格公式（Math） |
| 双端远程光标、选区映射 | 完整版本管理 UI |
| 预览区光标映射 | 版本对比（Phase 5，尚未实现） |

---

## 2. 总体架构

```text
┌──────────────────────────── 应用层 (App) ────────────────────────────┐
│  createEditor() 暴露：content(Y.Text) / getView / getMarkdown /        │
│  setLocalSelection / getRemoteCursors / getAwarenessUsers             │
└───────────────────────────────────┬──────────────────────────────────┘
                                     │
┌───────────────────────────────────▼──────────────────────────────────┐
│                    @collaflow/markdown 包                              │
│  ┌──────────────┐   ┌──────────────────────┐   ┌──────────────────┐  │
│  │   editor/    │   │   collab/             │   │   plugins/       │  │
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

### 核心结论：Y.Text 为唯一真相

与早期「`y-prosemirror` 绑定 `Y.XmlFragment('prosemirror')`」方案不同，当前实现**不使用 ProseMirror 文档作为协同载体**：

- 每个文档对应一个 `Y.Doc`，协同内容存于 `Y.Doc.getText('content')`（一个 `Y.Text`）。
- `CollaFlowProvider.content` 即该 `Y.Text`。本地模式（`collab` 未配置）则用一个独立 `Y.Doc` 的 `Y.Text` 承载，行为一致。
- 源码区（Milkdown 所见即所得）与预览区共享这同一份 `Y.Text`；任何一方修改都落到 `Y.Text`，再驱动另一端重渲染。

> 注：`y-prosemirror` 仍是依赖，但**仅**在 `editor/plugins/awareness.ts` 中用于 `yCursorPlugin` 渲染远端光标 / 选区的 widget decoration；它**不参与文档绑定**。

---

## 3. 包结构与模块职责

```text
packages/markdown/src/
├── index.ts                 # 公共 API 导出（createEditor / collab 工具 / cursor-map）
├── editor/
│   ├── index.ts             # createEditor / resolveEditorOptions 再导出
│   ├── factory.ts           # createEditor 工厂：构建插件、绑定 Y.Text、生命周期
│   ├── options.ts           # 配置合并与默认值
│   └── plugins/
│       ├── index.ts         # 插件集合（highlight/layout/awareness/theme）
│       ├── highlight.ts     # 代码块高亮（Prism / refractor）
│       ├── layout.ts        # Callout / Columns / Column / Card 自定义节点
│       ├── task-list.ts     # GFM 任务列表复选框点击切换
│       ├── theme.ts         # CollaFlow 主题 CSS 变量
│       ├── awareness.ts     # 远端光标 / 选区渲染（yCursorPlugin 封装）
│       └── cursor-map.ts    # 预览区光标映射（buildDomTextCounts 等）
├── collab/
│   ├── index.ts             # 协同接入入口
│   ├── provider.ts          # CollaFlowProvider（Hocuspocus 客户端，content: Y.Text）
│   ├── yjs-binding.ts       # Y.Text ↔ Milkdown 绑定、diffApply、origin 常量
│   └── cursor.ts            # 相对位置编解码（encode / decode / base64）
├── styles/
│   └── notion-style.ts      # 预览区 / 源码区 Notion 风格样式
└── types/
    └── index.ts             # 公共类型定义
```

> `src/diff/` 目录**不存在**（Phase 5 版本对比未实现），不要预先创建占位空文件。

---

## 4. 关键接口设计

### 4.1 编辑器配置

```ts
export interface CollaMarkdownEditorOptions {
  /** 挂载节点 */
  root: HTMLElement;
  /** 初始 Markdown 内容 */
  defaultValue?: string;
  /** 是否启用协同 */
  collab?: CollabOptions;
  /** 是否启用代码高亮 */
  highlight?: boolean | { type: 'prism' | 'shiki' };
  /** 主题配置 */
  theme?: 'light' | 'dark';
  /** 额外 Milkdown 插件 */
  plugins?: MilkdownPlugin[];
  /** 内容变更回调 */
  onChange?: (markdown: string) => void;
  /** 在线用户列表变化回调 */
  onAwarenessChange?: (users: AwarenessUserState[]) => void;
}

export interface CollabOptions {
  /** 房间/文档 ID（对应 Hocuspocus 文档名） */
  roomId: string;
  /** CollaFlow Core（Hocuspocus 协同服务）的 WebSocket 地址，如 ws://localhost:1234 */
  serverUrl: string;
  /** 用户 Awareness 信息（光标/在线列表展示） */
  user?: AwarenessUserInfo;
}

export interface AwarenessUserInfo {
  name: string;
  color: string;       // HEX
  avatar?: string;
}
```

### 4.2 编辑器实例

```ts
export interface CollaMarkdownEditor {
  /** 底层 Milkdown Editor 实例 */
  readonly editor: Editor;
  /** 协同内容源：以 Markdown 文本为唯一真相的 Yjs Y.Text（未启用协同时为本地文档） */
  readonly content: Y.Text;
  /** 获取底层 ProseMirror 视图（用于预览区光标定位） */
  getView(): EditorView;
  /** 当前 Markdown 内容（已 unescapeLeadingHash） */
  getMarkdown(): string;
  /** 设置 Markdown 内容（会重置编辑器状态） */
  setMarkdown(value: string): Promise<void>;
  /** 获取当前在线用户列表（需启用协同） */
  getAwarenessUsers(): AwarenessUserState[];
  /** 上报本地选区（Y.Text 字符偏移），用于远端光标显示 */
  setLocalSelection(anchor: number, head: number): void;
  /** 获取远端光标列表（已解码为 Y.Text 绝对偏移，需启用协同） */
  getRemoteCursors(): RemoteCursor[];
  /** 销毁编辑器并清理资源 */
  destroy(): Promise<void>;
}
```

### 4.3 协同 Provider 接口

> 实际实现见 `src/collab/provider.ts` 的 `CollaFlowProvider` 类。

```ts
export class CollaFlowProvider {
  /** 当前 Y.Doc */
  readonly doc: Y.Doc;
  /** 当前 Awareness */
  readonly awareness: awarenessProtocol.Awareness;
  /** 是否已连接（跟随 Hocuspocus 状态回调） */
  get isConnected(): boolean;
  /** 协同内容源：以 Markdown 文本为唯一真相的 Y.Text */
  get content(): Y.Text;
  /** 获取在线用户列表（过滤带 name+color 的客户端） */
  getAwarenessUsers(): AwarenessUserState[];
  /** 主动连接 */
  connect(): void;
  /** 断开连接（保留本地 doc） */
  disconnect(): void;
  /** 销毁并清理资源 */
  destroy(): void;
  /** 上报本地选区（以 Y.Text 字符偏移表示），编码为相对位置写入 awareness */
  setLocalSelection(anchor: number, head: number): void;
  /** 读取远端用户的光标列表（已解码为 Y.Text 绝对偏移） */
  getRemoteCursors(): RemoteCursor[];
}
```

---

## 5. 数据流

### 5.1 本地编辑 → 唯一真相 → 另一端

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

### 5.2 远端更新 → 本地

```text
WebSocket [0x00 + Yjs update]
   ↓ CollaFlowProvider 应用 update
Yjs 触发 document update
   ↓ observe（非自身 origin）
diffApply 反向驱动 Milkdown 重渲染
```

### 5.3 Awareness（光标 / 选区）

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

---

## 6. 模块详细设计

### 6.1 editor/factory.ts

- 使用 `Editor.make()` 创建 Milkdown 实例，默认注入 `commonmark` + `listener` + `block` preset。
- `resolveEditorOptions(options)` 合并默认值（`defaultValue: ''` / `highlight: true` / `theme: 'light'`）。
- 插件列表：`createThemePlugin(theme)` + 高亮插件 + `layoutNodes` + `gfm` + `taskListTogglePlugin` + 用户插件 + `createCollabPlugins(content)`。
- `onChange` 通过 `listenerCtx.markdownUpdated` 回调，输出 `unescapeLeadingHash(markdown)`。
- `getMarkdown()` 返回 `unescapeLeadingHash(editor.action(getMarkdown()))`。
- 存在 `collab` 配置时自动 `provider.connect()`；返回的实例暴露 `content` / `getView` / `setLocalSelection` / `getRemoteCursors` / `getAwarenessUsers`。

### 6.2 collab/provider.ts

- `CollaFlowProvider` 封装 `@hocuspocus/provider` 的 `HocuspocusProvider`。
- 构造时创建 `Y.Doc` 与 `awareness` 实例；若传入 `user` 则写入本地 awareness 状态。
- 通过 `url`（Hocuspocus 服务地址）+ `name`（即 `roomId`）建立连接，传输层（Yjs sync / awareness）完全交给 Hocuspocus。
- `content` getter 返回 `doc.getText('content')`（即唯一真相 `Y.Text`）。
- `getAwarenessUsers()` 从 awareness 状态中过滤出带 `name` + `color` 的客户端。
- `setLocalSelection` / `getRemoteCursors` 基于 `collab/cursor.ts` 的相对位置编解码。

### 6.3 collab/yjs-binding.ts

- `createCollabPlugins(content: Y.Text): MilkdownPlugin` 在 `InitReady` 后把 Milkdown 与 `Y.Text` 双向绑定：
  - `Y.Text` 变化（远端协同 / 源码区编辑）→ 触发 Milkdown 重新渲染；
  - Milkdown 编辑 → 序列化为 Markdown 写回 `Y.Text`（预览区改动也优先落到源码文本）。
- `diffApply(yText, newText, origin)` 以字符级 diff 把 `Y.Text` 对齐到目标文本，**不使用整体替换**，避免「整体替换式覆盖」丢失并发编辑。
- transaction origin 常量：`YJS_ORIGIN_MILKDOWN`（Milkdown 回写）、`YJS_ORIGIN_TEXTAREA`（源码区 textarea 回写）。`observe` 端据此跳过自己引发的更新，杜绝回声循环。

### 6.4 collab/cursor.ts

远端光标基于 `Y.Text` 的**相对位置**（记录「哪一项」而非「第几个字符」），并发插入导致下标漂移时仍可自愈，不会错位。

- `encodeRelativePosition(yText, index): string` → base64 相对位置。
- `decodeOffset(yText, encoded): number | null` → 当前文档下的绝对字符偏移（位置被删除则返回 `null`）。
- `decodeSelection(yText, selection): { anchor, head } | null` → 解码远端选区。

### 6.5 editor/plugins/cursor-map.ts

预览区是渲染后的富文本 DOM，而协同真相是 `Y.Text`（Markdown 纯文本）。要把「Markdown 第 o 个字符」定位到预览 DOM 中的真实坐标：

- `buildDomTextCounts(doc, markdown): number[]` —— 同步遍历 ProseMirror 文档与 Markdown 字符串，统计每个 Markdown 下标之前有多少「真实 DOM 文本字符」（去掉 `#` / `*` / 反引号 / 换行等语法字符）。返回 `counts[markdown.length + 1]`，`counts[i]` = `markdown[0..i)` 中的真实文本字符数。
- `markdownOffsetToDomTextOffset(counts, offset): number` —— 把 Y.Text 偏移换算为「真实 DOM 文本偏移」。
- 配合在预览容器里按真实文本字符偏移定位 DOM 节点，用 `getBoundingClientRect` 即可算出远端光标坐标，无需把 Markdown 偏移映射到 ProseMirror 坐标（那更脆弱）。
- 已知近似：覆盖 commonmark 常见节点；自定义布局节点（Callout / Columns 等）按纯文本近似，光标可能略有偏差。

应用层（如 `packages/app` 的 `MarkdownEditor.tsx`）使用 `getDomTextOffset(container, node, offset)`（基于 `document.createRange` + `TreeWalker`）把预览区点击事件换算为 Y.Text 偏移，已修复空行点击选区错算到文末的问题。

### 6.6 editor/plugins/awareness.ts

- 使用 `y-prosemirror` 的 `yCursorPlugin` 渲染远端光标。
- `createAwarenessPlugin(awareness)` 以自定义 `collaCursorBuilder` / `collaSelectionBuilder` 渲染光标与选区高亮（class `colla-cursor` / `colla-selection`，颜色取自 awareness 的 `user.color`）。
- 支持远端用户列表变化事件（经 `getAwarenessUsers()` 暴露）。

### 6.7 editor/plugins/highlight.ts

- 默认使用 `@milkdown/plugin-prism`（轻量，基于 refractor）。
- 语言列表按需加载，避免打包全部 prism 组件。
- 后续可切换为 `@milkdown/plugin-shiki` 以支持更多语言与主题。

### 6.8 editor/plugins/layout.ts

定义以下自定义节点（使用 `$node` 在 Milkdown 中注册）：

| 节点 | 说明 | Markdown 输出 |
|---|---|---|
| `callout` | 提示框，支持 info/warning/danger | HTML `<div class="callout" data-type="info">` |
| `columns` | 分栏容器 | HTML `<div class="columns">` |
| `column` | 单栏 | HTML `<div class="column">` |
| `card` | 卡片容器 | HTML `<div class="card">` |

> 注：当前布局节点已注册 schema 与 DOM 渲染，Markdown 双向转换（remark 插件）需后续迭代完善。

### 6.9 GFM 支持

通过 `@milkdown/preset-gfm` 统一提供表格、任务列表、脚注、删除线、自动链接的 schema 与输入规则：

- 表格：渲染 `<table>`，表头背景使用 `--cf-bg-tertiary`，边框使用 `--cf-border-default`。
- 任务列表：渲染为 `<li data-item-type="task" data-checked="...">`；`taskListTogglePlugin` 监听左侧 24px 热区点击，调用 `setNodeMarkup` 切换 `checked` 属性。
- 脚注：渲染为 `<sup data-type="footnote_reference">` 与 `<dl data-type="footnote_definition">`。
- 删除线：`<del>`，颜色使用 `--cf-text-secondary`。
- 自动链接：GFM 自动识别的 URL 渲染为 `<a>`，颜色使用 `--cf-accent-blue`。

所有 GFM 样式统一收敛到 `notion-style.ts`，全部使用 `@collaflow/design` 的 `--cf-*` CSS 变量。

### 6.9 序列化转义约定

Milkdown 序列化 Markdown 时会在行首防御性转义 `#` / `>` / `*` 等（如 `#` → `\#`）。当前策略用 **`unescapeLeadingHash(markdown)`** 仅还原「行首的 `\#`」为 `#`，其余转义保留。该函数在 `onChange` 回调、`getMarkdown()` 返回值、以及 `diffApply` 写回 `Y.Text` 三处统一生效。

> 已知取舍：单独的 `#`（无空格标题内容）在预览区仍表现为空标题（标准 CommonMark 行为），仅做了最小转义修复，未改解析器。

---

## 7. 依赖清单

```json
{
  "dependencies": {
    "@collaflow/design": "workspace:*",
    "@hocuspocus/provider": "^2.15.2",
    "@milkdown/core": "^7.22.1",
    "@milkdown/ctx": "^7.22.1",
    "@milkdown/plugin-block": "^7.22.1",
    "@milkdown/plugin-listener": "^7.22.1",
    "@milkdown/plugin-prism": "^7.22.1",
    "@milkdown/preset-commonmark": "^7.22.1",
    "@milkdown/preset-gfm": "^7.22.1",
    "@milkdown/utils": "^7.22.1",
    "prosemirror-state": "^1.4.4",
    "refractor": "^5.0.0",
    "y-prosemirror": "^1.3.7",
    "y-protocols": "^1.0.6",
    "yjs": "^13.6.24"
  },
  "devDependencies": {
    "@milkdown/transformer": "^7.22.1",
    "@types/node": "^20.17.6",
    "@vitest/coverage-v8": "^2.1.8",
    "jsdom": "^24.1.3",
    "rimraf": "^5.0.10",
    "tsup": "^8.3.5",
    "typescript": "^5.6.3",
    "vitest": "^2.1.8"
  }
}
```

> 编辑器为浏览器侧组件，若需在 Node 端运行测试，需配合 `jsdom` 提供 DOM 环境。

---

## 8. 与 CollaFlow Core 的集成边界

| 职责 | @collaflow/markdown | @collaflow/core |
|---|---|---|
| Y.Doc 创建与维护 | ✅（客户端） | ❌ |
| Y.Text 内容承载 | ✅（`doc.getText('content')`） | ❌ |
| Yjs update / awareness 转发 | ❌ | ✅（Hocuspocus） |
| WebSocket 连接管理 | ✅（客户端薄封装） | ✅（服务端） |
| 房间生命周期 | ❌ | ✅ |
| 文档持久化 | ❌ | 后续迭代 |
| 消息协议解析（0x00/0x01） | ❌（交由 Hocuspocus） | ✅ |

---

## 9. 实施路线图

### Phase 1：基础编辑器（MVP）✅ 已完成

1. ~~安装 Milkdown 依赖。~~
2. ~~实现 `createEditor()` 工厂函数，支持渲染 Markdown。~~
3. ~~接入 `@milkdown/plugin-listener`，支持 `onChange`。~~
4. ~~编写 vitest 测试：编辑器初始化、Markdown 输入输出。~~

### Phase 2：协同绑定（旧方案，已废弃）❌

> 早期方案基于 `y-prosemirror` 的 `ySyncPlugin` / `Y.XmlFragment('prosemirror')`，已在架构重构中被 `Y.Text` 方案取代，不再使用。

### Phase 2'：协同绑定（Y.Text 方案）✅ 已完成

1. ~~实现 `CollaFlowProvider`（Hocuspocus 客户端）。~~
2. ~~实现 `createCollabPlugins(content: Y.Text)` 与 `diffApply` 字符级合并。~~
3. ~~以 transaction origin 防回环。~~

### Phase 3：Awareness 与光标 ✅ 已完成

1. ~~基于 `Y.Text` 相对位置实现远端光标编解码（`collab/cursor.ts`）。~~
2. ~~自定义远端用户光标与选区样式（`colla-cursor` / `colla-selection`）。~~
3. ~~暴露 `getAwarenessUsers()` / `setLocalSelection` / `getRemoteCursors()` API。~~
4. ~~预览区光标映射（`cursor-map.ts` + 应用层 `getDomTextOffset`）。~~

### Phase 4：扩展插件 ✅ 已完成

1. ~~接入代码高亮（Prism），支持默认语言按需加载。~~
2. ~~实现 Callout / Columns / Column / Card 自定义节点。~~
3. ~~定义 CollaFlow 主题 CSS 变量与 `createThemePlugin`。~~

### 架构重构（commit `0910e11`）✅ 已完成

- 协同绑定由「`y-prosemirror` + `Y.XmlFragment`」改为「`Y.Text` + `diffApply` + transaction origin 防回环」。
- 新增预览区 / 源码区双端叠层远程光标（基于 Y.Text 相对位置）。
- 修复预览空行点击选区偏移错算到文末（`getDomTextOffset` 改用 Range 量化）。
- 修复行首 `#` 被序列化为 `\#`（`unescapeLeadingHash` 仅还原行首 `\#`）。
- 修正 `cursor-map` 对 `emphasis` / `inlineCode` / `hardbreak` 节点名的映射。
- 补充单测，markdown 包 67 项全过、覆盖率 100%。

### Phase 5：版本对比 ❌ 未实现

1. 实现基于 Yjs snapshot 的 diff。
2. 实现基于 ProseMirror changeset 的降级 diff（如需）。
3. 提供 `diffMarkdown(a, b)` 工具函数。
4. 补充单测，并保持 100% 覆盖率。

---

## 10. 风险与决策

### 10.1 已决策

- 编辑器底层：Milkdown 7.x（基于 ProseMirror）。
- **协同真相：`Y.Text`（Markdown 纯文本），而非 `Y.XmlFragment` / ProseMirror 文档树。**
- 代码高亮：先 Prism，后续可替换为 Shiki。
- 自定义节点：使用 `$node` + HTML 输出，保证 Markdown 可解析。
- 远端光标渲染：`y-prosemirror` 的 `yCursorPlugin`（仅渲染，不参与文档绑定）。

### 10.2 待决策

- 是否引入 `@milkdown/plugin-block` 的块级菜单做 Notion 式悬浮把手？（评估中，暂未实现）
- 服务端是否保存 Yjs 更新历史？（影响 Phase 5 diff 实现方式）
- 是否支持 Markdown 双向转换自定义 HTML 节点？（需要编写 remark 插件）
- 是否对 `#` 单独（无空格）做「非标题」语义修正？（当前仅做最小转义修复）

---

## 11. 参考

- [Milkdown 官方文档](https://milkdown.dev/)
- [ProseMirror 指南](https://prosemirror.net/docs/guide/)
- [y-prosemirror](https://github.com/yjs/y-prosemirror)（仅用于 awareness 光标渲染）
- [Hocuspocus 文档](https://tiptap.dev/docs/hocuspocus)
- `packages/markdown/src/` — 当前实现
- `.agents/skills/collamarkdown-tech-spec/` — 技术方案 Skill（含 `references/` 渐进性披露细分）
- `.agents/SKILL.md` — CollaFlow Skill 管理规范
