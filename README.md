# collaflow-monorepo

CollaFlow — 高性能协同脑图框架，支持 MCP 协议与私有化部署。Monorepo 结构，包含 CollaCore（协同服务）、CollaMind（脑图引擎）、CollaMarkdown（协作文档）等模块。

---

## AI 协作规范

本项目采用**项目级 Skill 自举管理**模式：

- Skill 管理器：`.agents/SKILL.md`
- 项目级 Skill：`.agents/skills/<name>/`
- 评分 rubric：`.agents/rubrics/collaflow.json`
- 评分报告：`.agents/reports/skill-score-report.json`
- 校验命令：`pnpm skills:validate`

新增或修改 Skill 时，必须运行评分并查看优化建议。

---

## Contact / 联系

For bug reports, feature requests, business cooperation, or security vulnerability disclosure, please contact us by email: **a1317827282@gmail.com**

问题反馈、功能建议、商务合作与安全漏洞报告，请发送邮件至：**a1317827282@gmail.com**
