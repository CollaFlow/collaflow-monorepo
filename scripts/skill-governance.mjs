#!/usr/bin/env node
/**
 * CollaFlow Skill 治理脚本（方案 A：项目级自举管理）
 *
 * 职责：
 * 1. 校验 .agents/skills/ 下所有 Skill 的结构与元数据
 * 2. 按 rubrics/collaflow.json 自动评分
 * 3. 生成优化建议
 * 4. 输出 .agents/reports/skill-score-report.json
 */

import { readFileSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import Ajv from 'ajv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

const AGENTS_DIR = join(ROOT, '.agents');
const SKILLS_DIR = join(AGENTS_DIR, 'skills');
const SCHEMA_PATH = join(AGENTS_DIR, 'schemas', 'manifest.schema.json');
const RUBRIC_PATH = join(AGENTS_DIR, 'rubrics', 'collaflow.json');
const REPORT_PATH = join(AGENTS_DIR, 'reports', 'skill-score-report.json');

const errors = [];
const warnings = [];
const scores = [];

function error(message) {
  errors.push(message);
  console.error(`❌ ${message}`);
}

function warn(message) {
  warnings.push(message);
  console.warn(`⚠️  ${message}`);
}

function ok(message) {
  console.log(`✅ ${message}`);
}

function readYaml(path) {
  const content = readFileSync(path, 'utf-8');
  return yaml.load(content);
}

function readJson(path) {
  const content = readFileSync(path, 'utf-8');
  return JSON.parse(content);
}

function readFrontmatter(path) {
  const content = readFileSync(path, 'utf-8');
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  if (!match) return null;
  return yaml.load(match[1]);
}

function readBody(path) {
  const content = readFileSync(path, 'utf-8');
  return content.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '');
}

function listSkillDirs(baseDir) {
  if (!existsSync(baseDir)) return [];
  const entries = readdirSync(baseDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules')
    .map((entry) => ({ name: entry.name, path: join(baseDir, entry.name) }));
}

function checkRelativePath(skillPath, refPath) {
  if (!refPath || (!refPath.startsWith('./') && !refPath.startsWith('../'))) return true;
  const resolved = resolve(skillPath, refPath);
  return existsSync(resolved);
}

// 安全性检查：简单模式匹配
function securityCheck(text) {
  const riskyPatterns = [
    /sk-[a-zA-Z0-9]{20,}/,
    /AKIA[0-9A-Z]{16}/,
    /ghp_[a-zA-Z0-9]{36}/,
    /private[_-]?key/i,
    /password\s*[:=]\s*["'][^"']{4,}["']/i,
    /api[_-]?key\s*[:=]\s*["'][^"']{4,}["']/i,
    /\b(?:192\.168\.|10\.\d+\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+)\b/,
  ];
  return riskyPatterns.some((pattern) => pattern.test(text));
}

// 评分函数
function scoreSkill(skill, schema, ajv, rubric) {
  const { name, path } = skill;
  const skillMd = join(path, 'SKILL.md');
  const manifestYaml = join(path, 'manifest.yaml');
  const dimensions = {
    completeness: 0,
    consistency: 0,
    clarity: 0,
    executability: 0,
    reusability: 0,
    security: 0,
  };
  const suggestions = [];

  // 0 分基线：缺少核心文件
  if (!existsSync(skillMd) || !existsSync(manifestYaml)) {
    return { total: 0, dimensions, suggestions: ['缺少 SKILL.md 或 manifest.yaml，无法评分'] };
  }

  let manifest;
  let frontmatter;
  let body = '';
  try {
    manifest = readYaml(manifestYaml);
    frontmatter = readFrontmatter(skillMd);
    body = readBody(skillMd);
  } catch (e) {
    return { total: 0, dimensions, suggestions: [`解析失败: ${e.message}`] };
  }

  // 1. 完整性 (20)
  const requiredManifestFields = ['name', 'version', 'owner', 'status', 'description'];
  const missingFields = requiredManifestFields.filter((f) => manifest[f] == null);
  const hasFrontmatter = frontmatter != null && frontmatter.name && frontmatter.version;
  const hasBody = body.length > 200;

  if (missingFields.length === 0 && hasFrontmatter && hasBody) {
    dimensions.completeness = 20;
  } else {
    dimensions.completeness = Math.max(0, 20 - missingFields.length * 4 - (hasFrontmatter ? 0 : 4) - (hasBody ? 0 : 4));
    if (missingFields.length > 0) suggestions.push(`manifest.yaml 缺少字段: ${missingFields.join(', ')}`);
    if (!hasFrontmatter) suggestions.push('SKILL.md 缺少 frontmatter 或字段不完整');
    if (!hasBody) suggestions.push('SKILL.md 正文过短，建议补充规则说明');
  }

  // 2. 一致性 (20)
  if (frontmatter) {
    const matchFields = ['name', 'version', 'owner', 'status'];
    const mismatches = matchFields.filter((f) => frontmatter[f] !== manifest[f]);
    const agentsDir = join(path, 'agents');
    let resourceOk = true;
    if (existsSync(agentsDir)) {
      const agentFiles = readdirSync(agentsDir).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));
      for (const agentFile of agentFiles) {
        const agent = readYaml(join(agentsDir, agentFile));
        if (agent?.interface?.icon_small && !checkRelativePath(path, agent.interface.icon_small)) resourceOk = false;
        if (agent?.interface?.icon_large && !checkRelativePath(path, agent.interface.icon_large)) resourceOk = false;
      }
    }

    if (mismatches.length === 0 && resourceOk) {
      dimensions.consistency = 20;
    } else {
      dimensions.consistency = Math.max(0, 20 - mismatches.length * 5 - (resourceOk ? 0 : 5));
      if (mismatches.length > 0) suggestions.push(`SKILL.md frontmatter 与 manifest.yaml 不一致: ${mismatches.join(', ')}`);
      if (!resourceOk) suggestions.push('agents/ 中引用的资源文件不存在');
    }
  } else {
    dimensions.consistency = 0;
  }

  // 3. 清晰性 (20)
  const hasTriggers = /[#\n]触发条件/.test(body) || /[#\n]Triggers/i.test(body);
  const hasRules = /[#\n]规则/.test(body) || /[#\n]Rules/i.test(body);
  const hasClearHeadings = (body.match(/^## /gm) || []).length >= 2;

  if (hasTriggers && hasRules && hasClearHeadings) {
    dimensions.clarity = 20;
  } else {
    dimensions.clarity = (hasTriggers ? 7 : 0) + (hasRules ? 7 : 0) + (hasClearHeadings ? 6 : 0);
    if (!hasTriggers) suggestions.push('建议增加「触发条件」章节');
    if (!hasRules) suggestions.push('建议增加「规则」章节');
    if (!hasClearHeadings) suggestions.push('建议用 ## 标题组织内容');
  }

  // 4. 可执行性 (20)
  const hasExamples = /[#\n]示例/.test(body) || /[#\n]Examples/i.test(body);
  const hasSteps = /\d+\./.test(body) && /步骤|执行|流程/i.test(body);
  const hasForbidden = /禁止|避免|不要|Never|Don't/i.test(body);

  if (hasExamples && hasSteps && hasForbidden) {
    dimensions.executability = 20;
  } else {
    dimensions.executability = (hasExamples ? 8 : 0) + (hasSteps ? 7 : 0) + (hasForbidden ? 5 : 0);
    if (!hasExamples) suggestions.push('建议增加「示例」章节');
    if (!hasSteps) suggestions.push('建议增加可执行的步骤或流程说明');
    if (!hasForbidden) suggestions.push('建议增加「禁止事项」或边界说明');
  }

  // 5. 复用性 (15)
  const hasScope = Array.isArray(manifest.scope) && manifest.scope.length > 0;
  const hasGenericFlag = manifest.generic === true;
  const bodyLower = body.toLowerCase();
  const projectSpecificTerms = ['collaflow', 'collacore', 'collamind', 'collamarkdown'];
  const specificCount = projectSpecificTerms.filter((t) => bodyLower.includes(t.toLowerCase())).length;
  const isGenericEnough = specificCount <= 1;

  if (hasScope && isGenericEnough) {
    dimensions.reusability = hasGenericFlag ? 15 : 12;
    if (!hasGenericFlag) suggestions.push('该 Skill 复用性较好，可考虑设置 generic: true');
  } else {
    dimensions.reusability = (hasScope ? 7 : 0) + (isGenericEnough ? 5 : 0) + (hasGenericFlag ? 3 : 0);
    if (!hasScope) suggestions.push('建议设置 scope 说明适用范围');
    if (!isGenericEnough) suggestions.push('Skill 中绑定过多项目专属名词，建议抽象为通用规则');
  }

  // 6. 安全性 (5)
  const fullText = readFileSync(skillMd, 'utf-8') + readFileSync(manifestYaml, 'utf-8');
  if (!securityCheck(fullText)) {
    dimensions.security = 5;
  } else {
    dimensions.security = 0;
    suggestions.push('检测到可能的敏感信息（密钥/内网地址/密码），请检查');
  }

  // 计算总分
  const weights = rubric.dimensions;
  const total = Math.round(
    Object.keys(dimensions).reduce((sum, key) => {
      return sum + dimensions[key] * (weights[key].weight / 20);
    }, 0)
  );

  // 通用能力建议
  if (total >= rubric.rules.genericMinScore && !manifest.generic) {
    suggestions.push(`评分 ${total} ≥ ${rubric.rules.genericMinScore}，建议标记 generic: true 沉淀为通用能力`);
  }

  return { total, dimensions, suggestions };
}

// 主流程
const schema = readJson(SCHEMA_PATH);
const rubric = readJson(RUBRIC_PATH);
const ajv = new Ajv({ allErrors: true, strict: false });

const skills = listSkillDirs(SKILLS_DIR);

console.log('\n📋 CollaFlow Skill 治理与评分\n');

if (skills.length === 0) {
  console.log('ℹ️  当前没有项目级 Skill。');
}

for (const skill of skills) {
  const { name, path } = skill;
  const manifestYaml = join(path, 'manifest.yaml');

  // 结构校验
  if (!existsSync(join(path, 'SKILL.md'))) {
    error(`[${name}] 缺少 SKILL.md`);
    continue;
  }
  if (!existsSync(manifestYaml)) {
    error(`[${name}] 缺少 manifest.yaml`);
    continue;
  }

  let manifest;
  try {
    manifest = readYaml(manifestYaml);
  } catch (e) {
    error(`[${name}] manifest.yaml 解析失败: ${e.message}`);
    continue;
  }

  const valid = ajv.validate(schema, manifest);
  if (!valid) {
    ajv.errors.forEach((err) => {
      error(`[${name}] manifest.yaml ${err.instancePath || '/'}: ${err.message}`);
    });
  }

  // 评分
  const result = scoreSkill(skill, schema, ajv, rubric);
  scores.push({
    name,
    path: `.agents/skills/${name}`,
    version: manifest.version,
    status: manifest.status,
    generic: manifest.generic || false,
    ...result,
  });

  // 输出
  const level = result.total < rubric.thresholds.block ? '🔴' : result.total < rubric.thresholds.warn ? '🟡' : '🟢';
  console.log(`${level} [${name}] v${manifest.version} — ${result.total}/100`);
  if (result.suggestions.length > 0) {
    result.suggestions.forEach((s) => console.log(`   💡 ${s}`));
  }

  if (result.total < rubric.thresholds.block) {
    error(`[${name}] 评分 ${result.total} 低于准入线 ${rubric.thresholds.block}，必须整改`);
  } else if (result.total < rubric.thresholds.warn) {
    warn(`[${name}] 评分 ${result.total} 建议优化至 ${rubric.thresholds.warn} 以上`);
  } else {
    ok(`[${name}] 评分通过`);
  }
}

// 生成报告
const report = {
  evaluatedAt: new Date().toISOString(),
  rubric: `${rubric.name}@${rubric.version}`,
  thresholds: rubric.thresholds,
  skills: scores,
  summary: {
    total: scores.length,
    block: scores.filter((s) => s.total < rubric.thresholds.block).length,
    warn: scores.filter((s) => s.total >= rubric.thresholds.block && s.total < rubric.thresholds.warn).length,
    good: scores.filter((s) => s.total >= rubric.thresholds.warn).length,
    generic: scores.filter((s) => s.generic).length,
  },
};

writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

// 输出摘要
console.log('\n---');
console.log(`Skill 总数: ${report.summary.total}`);
console.log(`🔴 需整改 (< ${rubric.thresholds.block}): ${report.summary.block}`);
console.log(`🟡 建议优化 (< ${rubric.thresholds.warn}): ${report.summary.warn}`);
console.log(`🟢 良好 (≥ ${rubric.thresholds.warn}): ${report.summary.good}`);
console.log(`⭐ 通用能力: ${report.summary.generic}`);
console.log(`\n评分报告已保存: ${REPORT_PATH}`);

if (errors.length > 0) {
  console.log('\n请先修复以上错误。');
  process.exit(1);
}

if (warnings.length > 0) {
  console.log('\n建议处理以上警告。');
}

console.log('\n🎉 Skill 治理校验通过。');
