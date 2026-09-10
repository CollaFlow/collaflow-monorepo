# CollaMarkdown 技术方案

> 版本：0.2.0  
> 状态：设计中  
> 目标：在 CollaFlow 协同基础设施之上，构建基于 Milkdown + ProseMirror + Yjs 的协作文档能力。

---

## 1. 目标与范围

### 1.1 目标

- 提供标准 Markdown 输入/输出的所见即所得编辑器。
- 复用 CollaFlow Core（@collaflow/core）基于 Hocuspocus 的 Yjs 协同通道，实现多人实时协同编辑。
- 支持代码块语法高亮、文本高亮、自定义布局节点（Callout / 分栏 / 卡片）。
- 提供版本对比（diff）工具链，便于后续历史版本管理。
- 保持包内分层清晰，所有扩展通过 Milkdown 插件实现。

### 1.2 范围

| 在范围内 | 不在范围内（后续迭代） |
|---|---|
| 客户端编辑器核心与插件 | 服务端持久化存储策略 |
| 与 CollaFlow Core（@collaflow/core）的 Yjs / Awareness 集成 | 富文本格式导入导出（Word/PDF） |
| 代码高亮、文本高亮、Callout 节点 | 表格公式（Math） |
| 基础版本对比工具 | 完整版本管理 UI |

---

## 2. 总体架构

```text
┌─────────────────────────────────────────────────────────────┐
│                        应用层 (App)                          │
│   @collaflow/markdown 提供的编辑器 API                       │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                    CollaMarkdown 包（@collaflow/markdown）                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │   editor/    │  │   collab/    │  │     plugins/     │   │
│  │  Milkdown    │  │ y-prosemirror│  │ highlight/layout │   │
│  │   封装       │  │   绑定       │  │ /awareness/theme │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                    @collaflow/core（Hocuspocus 协同服务）                      │
│    Hocuspocus 托管 Y.Doc 与 WebSocket 转发（Update/Awareness） │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 包结构与模块职责

```text
packages/markdown/src/
├── index.ts                 # 公共 API 导出（createEditor 等）
├── editor/
│   ├── index.ts             # 编辑器实例封装
│   ├── factory.ts           # createEditor 工厂函数
│   ├── options.ts           # 编辑器配置类型与默认值
│   └── plugins/
│       ├── index.ts         # 插件集合
│       ├── highlight.ts     # 代码块高亮（Prism）
│       ├── layout.ts        # Callout / Columns / Column / Card 节点
│       ├── awareness.ts     # 协同光标、选区提示
│       └── theme.ts         # 主题与 CSS 变量
├── collab/
│   ├── index.ts             # 协同接入入口
│   ├── yjs-binding.ts       # y-prosemirror 绑定（ySync / yCursor / yUndo）
│   └── provider.ts          # CollaFlowProvider（Hocuspocus 客户端）
└── types/
    └── index.ts             # 公共类型定义
```

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
  highlight?: boolean | HighlightOptions;
  /** 主题配置 */
  theme?: 'light' | 'dark' | ThemeConfig;
  /** 插件扩展 */
  plugins?: MilkdownPlugin[];
  /** 内容变更回调 */
  onChange?: (markdown: string) => void;
}

export interface CollabOptions {
  /** 房间/文档 ID（Hocuspocus 文档名） */
  roomId: string;
  /** CollaFlow Core（Hocuspocus）服务地址，如 ws://localhost:1234 */
  serverUrl: string;
  /** 用户 Awareness 信息（光标/在线列表展示） */
  user?: AwarenessUserInfo;
}

export interface AwarenessUserInfo {
  name: string;
  color: string;
  avatar?: string;
}
```

### 4.2 编辑器实例

```ts
export interface CollaMarkdownEditor {
  /** 底层 Milkdown Editor 实例 */
  readonly editor: Editor;
  /** 当前 Markdown 快照 */
  getMarkdown(): string;
  /** 设置 Markdown 内容（会重置编辑器状态） */
  setMarkdown(value: string): Promise<void>
  /** 销毁编辑器并清理协同连接 */
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
  /** 获取在线用户列表 */
  getAwarenessUsers(): AwarenessUserState[];
  /** 主动连接 */
  connect(): void;
  /** 断开连接（保留本地 doc） */
  disconnect(): void;
  /** 销毁并清理资源 */
  destroy(): void;
}
```

---

## 5. 数据流

### 5.1 本地编辑 → 远端

```text
用户输入
   ↓
ProseMirror Transaction
   ↓
y-prosemirror Plugin
   ↓
Yjs Update (Y.Doc)
   ↓
CollaFlowProvider（HocuspocusProvider）
   ↓
WebSocket（Hocuspocus 处理 0x00 Yjs update）
   ↓
Hocuspocus（CollaFlow Core）广播给房间内其他用户
```

### 5.2 远端更新 → 本地

```text
WebSocket [0x00 + Yjs update]
   ↓
CollaFlowProvider 应用 update（Hocuspocus 解包）
   ↓
Yjs 触发 document update
   ↓
y-prosemirror Plugin 同步到 ProseMirror State
   ↓
视图刷新
```

### 5.3 Awareness（光标/选区）

```text
本地选区变化
   ↓
y-prosemirror / y-protocols awareness
   ↓
Yjs Awareness Update
   ↓
Hocuspocus 传输层自动封装（awareness 消息）
   ↓
远端渲染为 widget decoration（colla-cursor / colla-selection）
```

> 注：Yjs sync 与 awareness 的传输封装（对应 0x00 / 0x01 消息类型）由 Hocuspocus 与 `@hocuspocus/provider` 完成，应用层无需手动分包。

---

## 6. 模块详细设计

### 6.1 editor/factory.ts

- 使用 `Editor.make()` 创建 Milkdown 实例。
- 默认注入 `commonmark` preset。
- 注册 `listener` 插件，将编辑器内容变化序列化为 Markdown，触发 `onChange`。
- 注册 `collab` 插件（仅在 `collab` 配置存在时）。
- 注册 `theme` 插件与 CSS 变量。

### 6.2 collab/provider.ts

- `CollaFlowProvider` 封装 `@hocuspocus/provider` 的 `HocuspocusProvider`。
- 构造时创建 `Y.Doc` 与 `awareness` 实例；若传入 `user` 则写入本地 awareness 状态。
- 通过 `url`（Hocuspocus 服务地址，如 `ws://localhost:1234`）+ `name`（即 `roomId`）建立连接，传输层（Yjs sync / awareness）完全交给 Hocuspocus。
- `onStatus` 回调驱动 `isConnected`；`getAwarenessUsers()` 从 awareness 状态中过滤出带 `user` 信息的客户端。
- 提供 `connect()` / `disconnect()` / `destroy()` 生命周期管理。

### 6.3 collab/yjs-binding.ts

- `createCollabPlugins(yXmlFragment, awareness)` 将 y-prosemirror 插件注入 Milkdown 的 ProseMirror 插件列表。
- 使用 `ySyncPlugin` 绑定 `Y.XmlFragment('prosemirror')`，`createAwarenessPlugin(awareness)`（内部基于 `yCursorPlugin`）渲染远端光标/选区，`yUndoPlugin` 提供协同感知的撤销/重做。
- 在 `InitReady` 后挂入 `prosePluginsCtx`。

### 6.4 plugins/highlight.ts

- 默认使用 `@milkdown/plugin-prism`（轻量、易打包）。
- 后续可切换为 `@milkdown/plugin-shiki` 以支持更多语言与主题。
- 语言列表按需加载，避免打包全部 prism 组件。

### 6.5 plugins/layout.ts

定义以下自定义节点：

| 节点 | 说明 | Markdown 输出 |
|---|---|---|
| `callout` | 提示框，支持 info/warning/danger | HTML `<div class="callout" data-type="info">` |
| `columns` | 分栏容器 | HTML `<div class="columns">` |
| `column` | 单栏 | HTML `<div class="column">` |
| `card` | 卡片容器 | HTML `<div class="card">` |

- 使用 `$node` 在 Milkdown 中注册。
- 通过 `remark` 插件处理 HTML 输入/输出，保证 Markdown 可解析。

### 6.6 plugins/awareness.ts

- 使用 `y-prosemirror` 的 `yCursorPlugin` 渲染远端光标。
- 通过 Awareness 的 `user` 字段展示用户名与颜色。
- 支持选区高亮（selection）与远端用户列表变化事件。

### 6.7 diff/index.ts

- 基于 `Y.encodeStateAsUpdate(doc)` 获取当前文档状态。
- 版本对比策略：
  1. 首选 Yjs snapshot diff：对比两个时间点的 Yjs 状态，生成插入/删除范围。
  2. 降级到 ProseMirror changeset：将两个 Markdown 解析为 ProseMirror 文档，使用 `prosemirror-changeset` 计算差异。
- 输出统一的 `MarkdownDiff` 结构，便于 UI 渲染。

---

## 7. 依赖清单

```json
{
  "dependencies": {
    "@collaflow/design": "workspace:*",
    "@hocuspocus/provider": "^2.15.2",
    "@milkdown/core": "^7.22.1",
    "@milkdown/ctx": "^7.22.1",
    "@milkdown/preset-commonmark": "^7.22.1",
    "@milkdown/plugin-listener": "^7.22.1",
    "@milkdown/plugin-prism": "^7.22.1",
    "@milkdown/plugin-block": "^7.22.1",
    "@milkdown/utils": "^7.22.1",
    "refractor": "^5.0.0",
    "y-prosemirror": "^1.3.7",
    "y-protocols": "^1.0.6",
    "yjs": "^13.6.24"
  }
}
```

> 注：编辑器为浏览器侧组件，若需在 Node 端运行测试，需配合 `happy-dom` 或 `jsdom` 提供 DOM 环境。

---

## 8. 与 CollaFlow Core 的集成边界

| 职责 | @collaflow/markdown | @collaflow/core |
|---|---|---|
| Y.Doc 创建与维护 | ✅ | ❌ |
| Yjs update / awareness 转发 | ❌ | ✅ |
| WebSocket 连接管理 | ✅（客户端） | ✅（服务端） |
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

### Phase 2：协同绑定 ✅ 已完成

1. ~~实现 `CollaFlowProvider`（Hocuspocus 客户端）。~~
2. ~~集成 `y-prosemirror` 的 `ySyncPlugin` / `yCursorPlugin` / `yUndoPlugin`。~~
3. ~~编写测试：模拟 WebSocket，验证 Yjs update 双向同步。~~

### Phase 3：Awareness 与光标 ✅ 已完成

1. ~~接入 `yCursorPlugin`。~~
2. ~~自定义远端用户光标与选区样式（`colla-cursor` / `colla-selection`）。~~
3. ~~暴露 `getAwarenessUsers()` 与 `onAwarenessChange` 在线用户列表 API。~~
4. ~~编写测试：模拟 Awareness 更新，验证 decoration 生成。~~

### Phase 4：扩展插件 ✅ 已完成

1. ~~接入代码高亮（Prism），支持默认语言按需加载。~~
2. ~~实现 Callout / Columns / Column / Card 自定义节点。~~
3. ~~定义 CollaFlow 主题 CSS 变量与 `createThemePlugin`。~~
4. ~~编写插件测试。~~

> 注：当前布局节点已注册 schema 与 DOM 渲染，Markdown 双向转换（remark 插件）将在后续迭代完善。

### Phase 5：版本对比

1. 实现基于 Yjs snapshot 的 diff。
2. 实现基于 ProseMirror changeset 的降级 diff。
3. 提供 `diffMarkdown(a, b)` 工具函数。

---

## 10. 风险与决策

### 10.1 已决策

- 编辑器底层：Milkdown 7.x（基于 ProseMirror）。
- 协同桥接：y-prosemirror。
- 代码高亮：先 Prism，后续可替换为 Shiki。
- 自定义节点：使用 `$node` + HTML 输出，保证 Markdown 可解析。

### 10.2 待决策

- 是否引入 `@milkdown/plugin-block` 提供块级菜单？（建议 Phase 4 后评估）
- 服务端是否保存 Yjs 更新历史？（影响 diff 实现方式）
- 是否支持 Markdown 双向转换自定义 HTML 节点？（需要编写 remark 插件）

---

## 11. 参考

- [Milkdown 官方文档](https://milkdown.dev/)
- [ProseMirror 指南](https://prosemirror.net/docs/guide/)
- [y-prosemirror](https://github.com/yjs/y-prosemirror)
- [CollaFlow Core 协同服务](../core/src/collab/collab.server.ts)
- [项目 Skill：collamarkdown-tech-spec](../../.agents/skills/collamarkdown-tech-spec/SKILL.md)
