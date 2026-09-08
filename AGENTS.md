# AGENTS.md — CollaFlow Monorepo

> 本文件面向 AI 编码助手与协作者，补充 README 未覆盖的工程约定。

## 项目概览

CollaFlow 是一个基于 pnpm workspace 的 TypeScript monorepo，包含三个核心子包：

| 包名 | 路径 | 职责 |
|---|---|---|
| `@collaflow/collacore` | `packages/collacore` | 协同服务核心（同步、鉴权、房间管理） |
| `@collaflow/collamind` | `packages/collamind` | 脑图引擎（节点模型、布局、增量计算） |
| `@collaflow/collamarkdown` | `packages/collamarkdown` | 协作文档（Markdown 解析与协同编辑） |

## 技术栈

- **包管理**：pnpm 8.x
- **运行时**：Node.js >= 20
- **语言**：TypeScript 5.6.x
- **构建**：tsup（输出 ESM + CJS + DTS）
- **测试**：Vitest
- **版本/发布**：Changesets
- **Git 规范**：Husky + commitlint（Conventional Commits）

## 常用命令

```bash
# 安装依赖
pnpm install

# 类型检查（所有子包）
pnpm typecheck

# 运行测试（所有子包）
pnpm test

# 构建（所有子包）
pnpm build

# 清理构建产物
pnpm clean

# 子包单独操作
pnpm --filter @collaflow/collamind run test
pnpm --filter @collaflow/collacore run build
```

## 依赖管理约定

- **公共 devDependencies 上浮到根**：`typescript`、`tsup`、`vitest`、`rimraf`、`@types/node` 等工具统一在根 `package.json` 中声明，子包 `devDependencies` 保持为空或仅保留特有依赖。
- **子包运行时依赖**：未来子包之间若存在真实依赖，使用 workspace 协议：`"@collaflow/collacore": "workspace:*"`。
- **peerDependencies 处理**：根 `.npmrc` 已设置 `auto-install-peers=true` 和 `strict-peer-dependencies=false`，可减少安装噪音。

## 构建系统

- 每个子包使用 `tsup.config.ts` 构建，输出到 `dist/`。
- 输出格式：`esm`（`.mjs`）、`cjs`（`.js`）、类型声明（`.d.ts` / `.d.mts`）。
- `dist/` 已被 `.gitignore` 忽略，不应提交。
- 发布时通过 `files: ["dist"]` 仅发布构建产物。

## TypeScript 配置

- 根配置：`tsconfig.base.json`，启用严格模式（`strict`、`noUnusedLocals`、`verbatimModuleSyntax` 等）。
- 子配置：`packages/*/tsconfig.json` 继承根配置，仅用于类型检查（`tsc --noEmit`）。
- 模块策略：`module: ESNext`、`moduleResolution: Bundler`，与 tsup 保持一致。

## Git 规范

- 提交格式：`type(scope): subject`
- 允许的 `type`：`feat`、`fix`、`docs`、`refactor`、`perf`、`test`、`build`、`ci`、`chore`、`revert`
- 允许的 `scope`：`collacore`、`collamind`、`collamarkdown`、`root`、`deps`、`ci`、`release`
- 示例：`feat(collamind): 支持节点增量布局计算`

## 版本发布

- 使用 Changesets 管理版本：`pnpm changeset` 创建变更集，`pnpm version-packages` 更新版本，`pnpm release` 构建并发布。
- 当前所有子包均为 `private: true`，正式发布前需移除该字段。

## CI/CD

- 工作流位于 `.github/workflows/ci.yml`。
- 触发条件：`main` 分支的 push / pull_request。
- 矩阵：Node 20 / 22，pnpm 8。
- 步骤：install → typecheck → test → build，PR 额外运行 commitlint。

## 代码风格

- 使用 `.editorconfig`：UTF-8、LF、2 空格缩进、文件末尾保留空行。
- 仓库统一使用 LF 行尾，由 `.gitattributes` 控制。
- 当前未配置 ESLint / Prettier，后续如需引入请从根统一配置。

## 给 Agent 的注意事项

- 修改子包结构、构建配置、CI 工作流或依赖时，请同步更新本文件。
- 不要提交 `dist/`、`node_modules/`、`.husky/_/` 或 `*.tsbuildinfo`。
- 添加新的公共子包时，记得在根 `package.json` 的 commitizen scopes 和 `commitlint.config.cjs` 中补充 scope。
- 子包对外暴露 API 时，建议优先使用**命名导出**，避免 ESM/CJS 双格式下的默认导出语义差异。
