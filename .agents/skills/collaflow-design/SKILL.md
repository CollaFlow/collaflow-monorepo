---
name: collaflow-design
description: CollaFlow 共享样式层 Skill：规范 @collaflow/design 设计令牌、主题、Tailwind 预设与 CSS 变量的使用方式
version: 0.1.0
owner: collaflow-core-team
status: draft
---

# CollaFlow 共享样式层（Design System）

> 本 Skill 定义 `@collaflow/design` 包的职责、导出规范以及在 `markdown`、`mind`、`app` 等前端包中的使用规则。
> 目标是让 CollaFlow 所有前端模块共享统一的视觉语言，禁止硬编码颜色、字号、间距、圆角、阴影等视觉变量。

## 触发条件

触发条件为以下任一场景：

- 需要新增、修改或扩展 `@collaflow/design` 包
- 需要在前端包（`markdown`、`mind`、`app`）中调整样式、主题、颜色、字体、间距、圆角、阴影
- 需要引入新的 Tailwind 预设或 CSS 变量
- 需要定义浅色/深色模式主题切换策略
- 发现前端包中存在硬编码视觉变量（如 `#F7F7F5`、`16px`、`8px`、`rgba(...)` 等）

## 规则

规则说明如下：

### 规则 1：@collaflow/design 是视觉基础层

`@collaflow/design` 是所有前端包的视觉单一真相来源（Single Source of Truth）。

它必须：
- 不依赖任何 `@collaflow/*` 包
- 无运行时依赖（纯数据 + CSS）
- 同时输出 ESM / CJS / DTS
- CSS 文件独立输出，支持只引入 CSS、不引入 JS 的使用方式

### 规则 2：前端包必须依赖 design

| 包 | 是否依赖 design | 使用方式 |
|---|---|---|
| `@collaflow/core` | ❌ | 后端包，无样式需求 |
| `@collaflow/collab-core` | ❌ | 协同抽象层，无样式需求 |
| `@collaflow/design` | — | 自身 |
| `@collaflow/markdown` | ✅ | 主题基于 design 令牌 |
| `@collaflow/mind` | ✅ | 主题基于 design 令牌 |
| `@collaflow/app` | ✅ | Tailwind preset + CSS 变量 |

添加依赖：

```json
{
  "dependencies": {
    "@collaflow/design": "workspace:*"
  }
}
```

### 规则 3：禁止硬编码视觉变量

在 `markdown`、`mind`、`app` 源码中，禁止直接硬编码以下视觉常量：

- 颜色值：十六进制（`#F7F7F5`）、RGB/RGBA（`rgba(0,0,0,0.1)`）、HSL 等
- 字号：`16px`、`14px` 等
- 间距：`4px`、`8px`、`16px` 等
- 圆角：`4px`、`8px` 等
- 阴影：具体 box-shadow 字符串

所有视觉变量必须通过 `@collaflow/design` 引入：

```ts
import { colors, typography, spacing, radius, shadow, lightTheme, darkTheme } from '@collaflow/design';
```

### 规则 4：design 包导出规范

`@collaflow/design` 的 `package.json` 必须包含以下 `exports`：

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    },
    "./tailwind": {
      "types": "./dist/tailwind/preset.d.ts",
      "import": "./dist/tailwind/preset.js",
      "require": "./dist/tailwind/preset.cjs"
    },
    "./css/variables.css": "./dist/css/variables.css",
    "./css/base.css": "./dist/css/base.css"
  }
}
```

目录结构：

```text
packages/design/src/
├── tokens/
│   ├── colors.ts
│   ├── typography.ts
│   ├── spacing.ts
│   ├── radius.ts
│   ├── shadow.ts
│   └── index.ts
├── themes/
│   ├── light.ts
│   ├── dark.ts
│   └── index.ts
├── tailwind/
│   └── preset.ts
├── css/
│   ├── variables.css
│   └── base.css
└── index.ts
```

### 规则 5：Tailwind 预设使用方式

前端项目（如 `app`）必须在 `tailwind.config.ts` 中引入 `collaflowPreset`：

```ts
import type { Config } from 'tailwindcss';
import { collaflowPreset, radius } from '@collaflow/design';

const config: Config = {
  presets: [collaflowPreset],
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'var(--cf-border-default)',
        background: 'var(--cf-bg-primary)',
        foreground: 'var(--cf-text-primary)',
      },
      borderRadius: {
        lg: radius.lg,
        md: radius.md,
        sm: radius.sm,
      },
    },
  },
};

export default config;
```

### 规则 6：CSS 变量使用方式

非 Tailwind 场景（如原生 CSS、第三方组件样式覆盖）直接引入 CSS 变量文件：

```css
@import '@collaflow/design/css/variables.css';

body {
  background-color: var(--cf-bg-primary);
  color: var(--cf-text-primary);
}
```

深色模式通过 `data-theme="dark"` 切换：

```html
<html data-theme="dark">
```

### 规则 7：主题切换策略

- 默认主题为 `light`
- 通过 `data-theme="dark"` 在 `html` 或容器元素上切换
- `app` 负责提供主题切换 UI 与状态管理
- `markdown`、`mind` 通过 `theme?: 'light' | 'dark'` 选项接收主题，并应用对应 design tokens

## 示例

示例如下：

### 示例 1：在 markdown 编辑器中使用 design 主题

```ts
import { createMarkdownEditor } from '@collaflow/markdown';

const editor = createMarkdownEditor({
  element: dom,
  theme: 'dark',
  content: '<p>Hello</p>',
});
```

### 示例 2：在 mind 地图中使用 design 主题

```ts
import { createMindMap } from '@collaflow/mind';

const map = await createMindMap({
  el: dom,
  theme: 'light',
});
```

### 示例 3：在 app 中引入 Tailwind preset 与 CSS 变量

```ts
// tailwind.config.ts
import { collaflowPreset } from '@collaflow/design';

export default {
  presets: [collaflowPreset],
  darkMode: ['class'],
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
};
```

```css
/* globals.css */
@import '@collaflow/design/css/variables.css';

@tailwind base;
@tailwind components;
@tailwind utilities;
```

## 实施步骤

1. **确认需求**：判断修改是否涉及视觉变量、主题、样式
2. **检查 design**：优先在 `@collaflow/design` 中新增或复用 token/theme/CSS
3. **更新前端包**：在 `markdown`、`mind`、`app` 中引入 design，避免硬编码
4. **验证无硬编码**：搜索 `#RRGGBB`、`rgba(...)`、`\d+px` 等模式，确保视觉变量均来自 design
5. **构建测试**：运行 `pnpm build`、`pnpm test`、`pnpm typecheck`，确保设计变更不影响其他包
6. **运行评分**：执行 `pnpm skills:validate`，确保本 Skill 得分 ≥ 80

## 禁止事项

- 不要在 `core`、`collab-core` 中引入 `@collaflow/design`
- 不要让 `@collaflow/design` 依赖任何 `@collaflow/*` 包
- 不要在 `markdown`、`mind`、`app` 中硬编码颜色、字号、间距、圆角、阴影
- 不要把业务组件样式下沉到 `@collaflow/design`
- 不要把服务端逻辑或运行时依赖放入 `@collaflow/design`
- 不要修改 design token 的语义命名，新增 token 需保持与 Notion 风格一致

## 参考

- `packages/design/` — `@collaflow/design` 实现
- `packages/app/tailwind.config.ts` — Tailwind preset 接入示例
- `packages/app/src/app/globals.css` — CSS 变量接入示例
- `packages/markdown/src/index.ts` — 编辑器主题接入示例
- `packages/mind/src/index.ts` — 脑图主题接入示例
- `.agents/SKILL.md` — CollaFlow Skill 管理规范
