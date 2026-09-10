---
name: collamarkdown-tech-spec
description: CollaMarkdown 技术方案 Skill：定义基于 Milkdown + ProseMirror + Yjs 的协作文档架构、扩展规范与实现步骤
version: 0.2.0
owner: collaflow-core-team
status: draft
---

# CollaMarkdown 技术方案

> 本 Skill 定义 `@collaflow/collamarkdown` 的技术选型、架构设计与实现规范。
> 目标是在 CollaFlow 现有协同基础设施（Yjs + WebSocket）之上，构建高性能、可二次扩展的协作文档能力。
> 详细设计见 `packages/collamarkdown/TECH_SPEC.md`。

## 触发条件

触发条件为以下任一场景：

- 需要实现或重构 `@collaflow/collamarkdown` 包
- 讨论协作文档编辑器选型（Markdown / WYSIWYG / 协同）
- 需要为 collamarkdown 增加高亮、布局分区、样式调整、协同、版本对比等功能
- 需要定义 collamarkdown 与 collacore 的集成边界

## 规则

规则说明如下：

### 规则 1：编辑器底层必须基于 Milkdown

`collamarkdown` 的文档编辑器统一使用 [Milkdown](https://milkdown.dev/) 作为基础框架。

理由：
- 专为 Markdown 设计，输入输出均为标准 Markdown
- 底层基于 ProseMirror，文档模型稳定、性能优秀
- MIT 协议，与 CollaFlow 的 Apache-2.0 协议兼容
- 插件化架构，易于扩展高亮、自定义节点、主题等能力

推荐依赖版本：

```json
{
  "@milkdown/core": "^7.22.1",
  "@milkdown/preset-commonmark": "^7.22.1",
  "@milkdown/plugin-listener": "^7.22.1",
  "@milkdown/plugin-prism": "^7.22.1",
  "@milkdown/plugin-block": "^7.22.1",
  "@milkdown/utils": "^7.22.1"
}
```

### 规则 2：协同层必须复用 collacore 的 Yjs 能力

`collamarkdown` 不单独维护协同连接，而是通过 `@collaflow/collacore` 暴露的 WebSocket 房间协议接入。

集成方式：
- 每个 Markdown 文档对应一个 `Y.Doc`
- 编辑器内容绑定到 `Y.XmlFragment('prosemirror')` 类型的共享数据
- 使用 `y-prosemirror` 桥接 ProseMirror 与 Yjs
- 用户光标、选区等协同提示通过 Yjs Awareness 机制实现
- WebSocket 消息严格遵循 CollaCore 协议：
  - `0x00` + Yjs document update payload
  - `0x01` + Yjs awareness update payload

### 规则 3：自定义功能必须通过 Milkdown 插件实现

所有扩展功能必须封装为 Milkdown 插件或自定义节点 / mark，保持编辑器核心干净。

常见扩展映射：

| 功能 | 实现方式 | 推荐插件/API |
|---|---|---|
| 代码块语法高亮 | 插件 | `@milkdown/plugin-prism`（默认）或 `@milkdown/plugin-shiki` |
| 文本高亮/标记 | 自定义 mark | `$mark` + 自定义 CSS |
| 自定义布局分区 | 自定义 node | `$node` + HTML 输出，配合 remark 解析 |
| 样式/主题 | 主题插件或 CSS 变量 | `themeFactory` 或覆盖 CSS 变量 |
| 协同光标 | y-prosemirror 插件 | `yCursorPlugin` + Awareness `user` 字段 |
| 版本对比 | 工具函数 | Yjs snapshot diff 或 `prosemirror-changeset` |

### 规则 4：包结构遵循统一分层

`packages/collamarkdown/src/` 目录结构必须按以下方式组织：

```text
src/
├── index.ts              # 公共 API 导出
├── editor/
│   ├── index.ts          # 编辑器实例封装
│   ├── factory.ts        # Editor.make() 工厂函数
│   ├── options.ts        # 编辑器配置类型与默认值
│   └── plugins/
│       ├── index.ts      # 插件集合
│       ├── highlight.ts  # 高亮相关插件
│       ├── layout.ts     # 自定义布局节点
│       ├── awareness.ts  # 协同提示插件
│       └── theme.ts      # 主题/样式配置
├── collab/
│   ├── index.ts          # 协同接入入口
│   ├── yjs-binding.ts    # Yjs 与 ProseMirror 绑定
│   └── provider.ts       # collacore WebSocket provider 适配
├── diff/
│   └── index.ts          # 版本对比工具
├── types/
│   └── index.ts          # 类型定义
└── utils/
    └── index.ts          # 辅助函数
```

### 规则 5：优先使用项目统一工具链

`collamarkdown` 必须与仓库其他包保持一致：
- 构建工具：`tsup`
- 测试框架：`vitest`
- 包管理：`pnpm`
- TypeScript：复用根目录 `tsconfig.base.json`
- 导出格式：CJS + ESM + DTS
- 浏览器侧代码测试需要 `happy-dom` 或 `jsdom` 提供 DOM 环境

### 规则 6：公共 API 必须保持类型友好

对外暴露的核心 API 应遵循以下接口：

```ts
export interface CollaMarkdownEditorOptions {
  root: HTMLElement;
  defaultValue?: string;
  collab?: {
    roomId: string;
    userId: string;
    serverUrl: string;
    user?: { name: string; color: string; avatar?: string };
  };
  highlight?: boolean;
  theme?: 'light' | 'dark';
  plugins?: MilkdownPlugin[];
  onChange?: (markdown: string) => void;
}

export interface CollaMarkdownEditor {
  readonly editor: Editor;
  getMarkdown(): string;
  setMarkdown(value: string): Promise<void>;
  destroy(): Promise<void>;
}
```

## 示例

示例如下：

### 示例 1：创建带代码高亮的 Milkdown 编辑器

```ts
import { createEditor } from '@collaflow/collamarkdown';

async function mount(dom: HTMLElement) {
  const editor = await createEditor({
    root: dom,
    defaultValue: '# Hello\n\n```js\nconst x = 1;\n```',
    highlight: true,
    theme: 'light',
    onChange: (markdown) => console.log(markdown),
  });

  return editor;
}
```

### 示例 2：接入 collacore 的 Yjs 协同

```ts
import { createEditor } from '@collaflow/collamarkdown';

async function mountCollab(dom: HTMLElement, roomId: string, userId: string) {
  const editor = await createEditor({
    root: dom,
    defaultValue: '# 协作文档',
    collab: {
      roomId,
      userId,
      serverUrl: 'wss://collacore.example.com',
      user: { name: 'Alice', color: '#ff6b6b' },
    },
    highlight: true,
  });

  return editor;
}
```

### 示例 3：定义一个自定义布局节点（Callout）

```ts
import { $node } from '@milkdown/utils';

export const calloutNode = $node('callout', () => ({
  group: 'block',
  content: 'block+',
  attrs: {
    type: { default: 'info' },
  },
  parseDOM: [{ tag: 'div.callout', getAttrs: (dom) => ({ type: dom.dataset.type }) }],
  toDOM: (node) => ['div', { class: 'callout', 'data-type': node.attrs.type }, 0],
}));
```

## 实施步骤

1. **技术预研**：确认 Milkdown 版本与现有 TypeScript / tsup 工具链兼容
2. **依赖安装**：在 `packages/collamarkdown` 中添加 `@milkdown/core`、`@milkdown/preset-commonmark`、`y-prosemirror` 等依赖
3. **基础编辑器**：实现一个可渲染 Markdown 的基础 Milkdown 编辑器
4. **高亮插件**：接入 Prism 实现代码块语法高亮
5. **协同绑定**：通过 `y-prosemirror` 将编辑器接入 collacore 的 Yjs 文档
6. **Awareness 提示**：实现远端用户光标、选区、操作提示
7. **自定义节点**：按需添加 callout、分栏、卡片等布局分区节点
8. **主题样式**：定义 CollaFlow 统一的 CSS 变量与主题
9. **版本对比**：基于 Yjs snapshot 或 ProseMirror changeset 实现 diff 能力
10. **测试覆盖**：为编辑器初始化、插件加载、协同绑定编写 vitest 测试

## 禁止事项

- 不要引入与 Milkdown / ProseMirror 定位重叠的富文本编辑器（如 Quill、Draft.js、Slate）
- 不要绕过 `collacore` 单独建立 WebSocket / Yjs 连接
- 不要把密钥、内网地址、个人隐私数据写入 Skill 或代码注释
- 不要直接在 `index.ts` 里堆积具体功能实现，必须通过插件或独立模块拆分
- 不要修改 Milkdown 内部 ProseMirror Schema 的默认行为，除非有明确的扩展需求并通过单测验证
- 不要将服务端逻辑（如文档持久化、房间管理）下沉到 `collamarkdown`

## 参考

- [Milkdown 官方文档](https://milkdown.dev/)
- [ProseMirror 指南](https://prosemirror.net/docs/guide/)
- [y-prosemirror](https://github.com/yjs/y-prosemirror)
- `packages/collamarkdown/TECH_SPEC.md` — 详细技术方案
- `.agents/SKILL.md` — CollaFlow Skill 管理规范
