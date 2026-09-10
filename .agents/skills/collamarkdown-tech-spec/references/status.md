# 状态参考：实施阶段、已知偏差与待办

> 本文件是 `collamarkdown-tech-spec` 的深入内容，记录与代码同步的状态。

## 实施阶段

### Phase 1~4：基础编辑器 + 协同 + Awareness + 扩展插件 ✅ 已完成

1. ~~`createEditor()` 工厂，渲染标准 Markdown~~
2. ~~`listener` 插件支持 `onChange`~~
3. ~~`CollaFlowProvider`（Hocuspocus 客户端）~~
4. ~~Awareness 在线用户列表与远端光标 / 选区（`yCursorPlugin`）~~
5. ~~代码高亮（Prism）、Callout / Columns / Column / Card 自定义节点、主题 CSS 变量~~

### 架构重构（commit `0910e11`）：Y.Text 为唯一真相 ✅ 已完成

- 协同绑定由「`y-prosemirror` + `Y.XmlFragment`」改为「`Y.Text` + `diffApply` + transaction origin 防回环」。
- 新增预览区 / 源码区双端叠层远程光标（基于 Y.Text 相对位置）。
- 修复预览空行点击选区偏移错算到文末（`getDomTextOffset` 改用 Range 量化）。
- 修复行首 `#` 被序列化为 `\#`（`unescapeLeadingHash` 仅还原行首 `\#`）。
- 修正 `cursor-map` 对 `emphasis` / `inlineCode` / `hardbreak` 节点名的映射。
- 补充单测，markdown 包 58 项全过、覆盖率 100%。

### Phase 5：版本对比 ❌ 未实现

- 尚未实现基于 Yjs snapshot 的 diff 与 `diffMarkdown(a, b)`。
- `src/diff/` 目录不存在；如需落地，按 conventions 规则 3 表末行以工具函数方式新增。

## 已知偏差 / 取舍

- **`cursor-map` 对自定义节点是纯文本近似**：覆盖 commonmark 常见节点；Callout / Columns 等自定义布局节点按纯文本处理，光标可能略有偏差。
- **`#` 单独仍渲染为空标题**：用户选择「最小修复」——仅还原行首 `\#` 转义，未改 Markdown 解析器。因此单独的 `#` 在预览区仍表现为空标题；符合标准 CommonMark 行为。若后续要「`#` 不算标题」，需改解析/渲染层（更大改动）。
- **`y-prosemirror` 依赖仍在**：仅用于 `awareness.ts` 的 `yCursorPlugin` 渲染，不参与文档绑定；不要据此误判为「文档绑定仍走 y-prosemirror」。

## 待办

- [x] **同步 `packages/markdown/TECH_SPEC.md`**：已重写为 Y.Text 架构（见本文档第 1~11 节），与代码及本 Skill 一致。
- [ ] 评估是否将本 Skill 标记为通用能力（连续两版评分 ≥ 90 且规则稳定后可设 `generic: true`）。
- [ ] 如做 Phase 5 版本对比，补充 `src/diff/` 与对应单测，并保持 100% 覆盖率。
