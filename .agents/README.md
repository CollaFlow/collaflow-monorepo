# .agents 目录说明

本目录集中管理 CollaFlow 项目的 **项目级 AI Skill**。

## 设计原则

- **项目级**：所有 Skill 只作用于当前仓库，不区分企业级/组织级。
- **自举管理**：`.agents/SKILL.md` 本身就是一个 Skill，它定义了如何管理其他 Skill。
- **评分驱动**：每个 Skill 都有自动评分，低分必须优化，高分可沉淀为通用能力。

## 目录结构

```text
.agents/
├── SKILL.md                 # Skill 管理器（自举）
├── README.md                # 本文件
├── skills/                  # 项目级 Skill
├── templates/skill/         # 新建 Skill 模板
├── schemas/                 # manifest 校验 Schema
├── rubrics/                 # 评分 rubric
└── reports/                 # 评分报告
```

## 快速开始

```bash
# 1. 创建新 Skill
cp -r .agents/templates/skill .agents/skills/my-skill

# 2. 编辑并运行评分
pnpm skills:validate

# 3. 查看报告
cat .agents/reports/skill-score-report.json
```

## 评分标准

详见 `.agents/SKILL.md` 中的「迭代优化流程」。

核心命令：`pnpm skills:validate`
