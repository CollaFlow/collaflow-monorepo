# @collaflow/collamarkdown

CollaMarkdown — CollaFlow 协作文档编辑器。

基于 [Milkdown](https://milkdown.dev/) + ProseMirror + Yjs 构建，标准 Markdown 输入输出，支持多人实时协同编辑。

---

## 特性

- 📝 **Markdown 优先**：输入/输出均为标准 Markdown
- 🔌 **协同编辑**：通过 `@collaflow/collacore` 的 Yjs 通道实现多人实时同步
- 🎨 **主题变量**：内置明暗主题 CSS 变量
- 💡 **代码高亮**：默认集成 Prism，支持常见语言
- 📦 **布局节点**：Callout / 分栏 / 卡片等自定义节点
- 👥 **Awareness**：在线用户列表与远端光标/选区提示

---

## 安装

```bash
pnpm add @collaflow/collamarkdown
```

---

## 基础用法

```ts
import { createEditor } from '@collaflow/collamarkdown';

const container = document.getElementById('editor');

const editor = await createEditor({
  root: container,
  defaultValue: '# Hello CollaMarkdown\n\n```js\nconst x = 1;\n```',
  highlight: true,
  theme: 'light',
  onChange: (markdown) => console.log(markdown),
});

// 获取当前 Markdown
console.log(editor.getMarkdown());

// 更新内容
await editor.setMarkdown('# Updated');

// 销毁
await editor.destroy();
```

---

## 协同编辑

```ts
const editor = await createEditor({
  root: container,
  defaultValue: '# 协作文档',
  collab: {
    roomId: 'doc-1',
    userId: 'user-1',
    serverUrl: 'wss://collacore.example.com',
    user: { name: 'Alice', color: '#ff6b6b' },
  },
  onAwarenessChange: (users) => {
    console.log('在线用户:', users);
  },
});
```

> 服务端需部署 `@collaflow/collacore`，WebSocket 路径为 `/ws/rooms/:roomId?userId=xxx`。

---

## 配置项

| 配置 | 类型 | 说明 |
|---|---|---|
| `root` | `HTMLElement` | 编辑器挂载节点（必填） |
| `defaultValue` | `string` | 初始 Markdown 内容 |
| `collab` | `CollabOptions` | 协同配置 |
| `highlight` | `boolean \| HighlightOptions` | 代码高亮，默认 `true` |
| `theme` | `'light' \| 'dark'` | 主题，默认 `light` |
| `plugins` | `MilkdownPlugin[]` | 额外 Milkdown 插件 |
| `onChange` | `(markdown: string) => void` | 内容变化回调 |
| `onAwarenessChange` | `(users: AwarenessUserState[]) => void` | 在线用户变化回调 |

---

## 开发

```bash
# 安装依赖
pnpm install

# 开发模式
pnpm dev

# 类型检查
pnpm typecheck

# 运行测试
pnpm test

# 构建
pnpm build
```

---

## 技术方案

详细设计见 [`TECH_SPEC.md`](./TECH_SPEC.md)。
