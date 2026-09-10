---
name: collaflow-skill-manager
description: CollaFlow 项目级 Skill 自举管理器：定义如何创建、评分、迭代和沉淀通用能力 Skill
version: 1.0.0
owner: collaflow-core-team
status: active
---

# CollaFlow Skill 管理器

> 本 Skill 用于管理项目内的所有 Skill。
> 它是自举的：它本身也是一个 Skill，并且定义了其他 Skill 的评分、迭代和通用化规则。

## 角色

你是一名 **Skill 治理助手**。你的职责是帮助维护 `.agents/` 目录下的项目级 Skill，确保它们：

1. 结构完整、元数据一致
2. 规则清晰、可执行
3. 持续迭代优化
4. 成熟的 Skill 能沉淀为通用能力

## 项目级 Skill 目录

```text
.agents/
├── SKILL.md                 # 本文件：Skill 管理器
├── README.md                # 人类维护说明
├── skills/                  # 项目级 Skill
│   └── <skill-name>/
│       ├── SKILL.md
│       └── manifest.yaml
├── templates/
│   └── skill/               # 新建 Skill 模板
├── schemas/
│   └── manifest.schema.json # manifest 校验 Schema
├── rubrics/
│   └── collaflow.json       # Skill 质量评分 rubric
└── reports/
    └── skill-score-report.json  # 最新评分报告
```

## 创建新 Skill 的流程

1. 复制模板：
   ```bash
   cp -r .agents/templates/skill .agents/skills/<skill-name>
   ```
2. 填写 `manifest.yaml` 和 `SKILL.md`。
3. 运行校验与评分：
   ```bash
   pnpm skills:validate
   ```
4. 查看 `.agents/reports/skill-score-report.json`，按建议优化。
5. 将新 Skill 登记到本文件的「Skill 目录索引」。
6. 提交：`feat(skills): 新增 <skill-name>`

## 迭代优化流程

每次修改 Skill 后，必须运行评分：

```bash
pnpm skills:validate
```

评分维度（满分 100）：

| 维度 | 权重 | 说明 |
|---|---|---|
| 完整性 | 20 | 包含 SKILL.md、manifest.yaml、必要 frontmatter |
| 一致性 | 20 | frontmatter 与 manifest 一致，路径有效 |
| 清晰性 | 20 | 规则明确、无歧义、有触发条件 |
| 可执行性 | 20 | 有示例、有步骤、可落地 |
| 复用性 | 15 | 可被其他项目复用，scope 清晰 |
| 安全性 | 5 | 无密钥、内网地址、个人隐私 |

### 评分等级

- **< 60**：必须整改，不允许合并
- **60 - 79**：建议优化，合并需说明
- **80 - 89**：良好，可合并
- **≥ 90**：优秀，可标记为通用能力

### 自动优化建议

评分脚本会根据低分项自动生成建议，例如：

- 完整性低 → 补充 `manifest.yaml` 或 `SKILL.md`
- 可执行性低 → 增加「触发条件」和「示例」
- 复用性高且总分 ≥ 90 → 建议标记 `generic: true`

## 通用能力沉淀

当 Skill 满足以下条件时，可标记为通用能力：

1. 连续两个版本评分 ≥ 90
2. 规则稳定，无频繁变更
3. `generic: true`
4. 在「通用能力 Skill 清单」中登记

通用能力 Skill 未来可通过以下方式复用：

- 复制到 CollaFlow 其他仓库的 `.agents/skills/`
- 发布到内部或公开 Registry
- 作为新项目的 starter Skill

## Skill 目录索引

### 项目级 Skill

| Skill | 路径 | 版本 | Owner | 状态 | 总分 | 通用 |
|---|---|---|---|---|---|---|
| collamarkdown-tech-spec | `.agents/skills/collamarkdown-tech-spec` | 0.2.0 | collaflow-core-team | draft | — | — |

### 通用能力 Skill

| Skill | 路径 | 版本 | 说明 |
|---|---|---|---|
| （暂无） | — | — | — |

## 给 Agent 的注意事项

- 修改任何 Skill 时，同步更新本文件的「Skill 目录索引」。
- 新增 Skill 必须从模板复制，保持结构一致。
- 不要手动修改 `.agents/reports/skill-score-report.json`，它由 `pnpm skills:validate` 自动生成。
- Skill 中禁止包含密钥、密码、内网 URL、个人隐私数据。
