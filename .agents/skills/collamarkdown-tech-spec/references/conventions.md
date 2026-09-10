# 规范参考：规则、禁止事项与工具链

> 本文件是 `collamarkdown-tech-spec` 的深入内容。核心原则见 `SKILL.md`；此处是仓库落地的具体规则。

## 规则

### 规则 1：编辑器底层基于 Milkdown 7.x

`@collaflow/markdown` 统一使用 [Milkdown](https://milkdown.dev/)（基于 ProseMirror）。推荐依赖：

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

### 规则 2：协同真相是 Y.Text，统一走 Hocuspocus

- **不使用 `y-prosemirror` 的 `Y.XmlFragment` 文档绑定**。协同载体是 `Y.Doc.getText('content')`（`Y.Text`）。
- 通过 `@hocuspocus/provider` 连接 `@collaflow/core` 的 Hocuspocus 服务；roomId 即文档名。
- 客户端 `HocuspocusProvider` 与服务端 `@hocuspocus/server` 必须同为 2.x，协议不跨大版本兼容。
- 客户端只做薄封装（`src/collab/provider.ts`），协议 / 重连 / 心跳交给 Hocuspocus。
- Milkdown 与 `Y.Text` 双向同步用 `createCollabPlugins` + `diffApply` + transaction origin 防回环，**禁止整体替换式写回 Y.Text**。
- 远端光标通过 Yjs Awareness 实现，坐标以 `Y.Text` 相对位置编码。

### 规则 3：扩展必须通过 Milkdown 插件

| 功能 | 实现方式 | 推荐插件 / API |
|---|---|---|
| 代码块高亮 | 插件 | `@milkdown/plugin-prism`（基于 refractor）或 `@milkdown/plugin-shiki` |
| 文本高亮 / 标记 | 自定义 mark | `$mark` + 自定义 CSS |
| 自定义布局分区 | 自定义 node | `$node` + HTML 输出，配合 remark 解析 |
| 样式 / 主题 | 主题插件或 CSS 变量 | `createThemePlugin` 或覆盖 CSS 变量 |
| 协同光标渲染 | `y-prosemirror` 的 `yCursorPlugin` | `createAwarenessPlugin(awareness)`（仅渲染，不参与文档绑定） |
| 版本对比 | 工具函数 | Yjs snapshot diff（Phase 5，尚未实现） |

### 规则 4：包结构遵循统一分层

```text
packages/markdown/src/
├── index.ts                 # 公共 API 导出
├── editor/
│   ├── index.ts             # createEditor / resolveEditorOptions 再导出
│   ├── factory.ts           # createEditor 工厂
│   ├── options.ts           # 配置合并与默认值
│   └── plugins/
│       ├── index.ts         # 插件集合
│       ├── highlight.ts     # 代码高亮（Prism / refractor）
│       ├── layout.ts        # Callout / Columns / Column / Card 节点
│       ├── theme.ts         # CollaFlow 主题 CSS 变量
│       ├── awareness.ts     # 远端光标 / 选区渲染
│       └── cursor-map.ts    # 预览区光标映射
├── collab/
│   ├── index.ts             # 协同接入入口
│   ├── provider.ts          # CollaFlowProvider（content: Y.Text）
│   ├── yjs-binding.ts       # Y.Text ↔ Milkdown 绑定、diffApply、origin
│   └── cursor.ts            # 相对位置编解码
├── styles/
│   └── notion-style.ts      # 预览区 / 源码区 Notion 风格样式
└── types/
    └── index.ts             # 公共类型定义
```

> `src/diff/` 目录**不存在**（Phase 5 版本对比未实现），不要预先创建占位空文件。

### 规则 5：优先使用项目统一工具链

- 构建：`tsup`（导出 CJS + ESM + DTS）
- 测试：`vitest`（浏览器侧代码测试需 `happy-dom` 或 `jsdom` 提供 DOM 环境）
- 包管理：`pnpm`
- TypeScript：复用根 `tsconfig.base.json`（含 `noUncheckedIndexedAccess: true`，索引访问返回 `T | undefined`）
- **覆盖率：`pnpm --filter @collaflow/markdown run test:coverage` 必须 100%（lines / branches / functions / statements），CI 卡阈值**。当前 58 项单测、100% 覆盖。
- 主题色一律从 `@collaflow/design` 读取，禁止在包内硬编码色值。

## 禁止事项

- 不要引入与 Milkdown / ProseMirror 定位重叠的富文本编辑器（Quill、Draft.js、Slate、TipTap）。
- 不要绕过 `@hocuspocus/provider` 自建 WebSocket 连接或自定义二进制协议。
- **不要把协同载体从 `Y.Text` 改回 `Y.XmlFragment` / ProseMirror 文档绑定**（除非有明确需求并经评审）。
- **不要对 `Y.Text` 做整体替换式写回**；必须用 `diffApply` + transaction origin 防回环。
- 不要把密钥、内网地址、个人隐私数据写入 Skill 或代码注释。
- 不要直接在 `index.ts` 里堆积具体功能实现，必须通过插件或独立模块拆分。
- 不要修改 Milkdown 内部 ProseMirror Schema 的默认行为，除非有明确扩展需求并通过单测验证。
- 不要将服务端逻辑（文档持久化、房间管理）下沉到 `@collaflow/markdown`。
- 不要为了凑覆盖率而在 `src/` 里留空占位文件；确实不可达的分支用 `/* c8 ignore next */` 标注并说明原因。

## 评分要求

- 修改本 Skill 后运行 `pnpm skills:validate`，确保总分 **≥ 80**（warn 阈值）；≥ 90 为优秀可标记通用能力。
- 不要手动修改 `.agents/reports/skill-score-report.json`（由校验脚本自动生成）。
