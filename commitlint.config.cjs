/**
 * Conventional Commits 校验规则（配合 husky commit-msg hook）。
 * 格式：type(scope): subject
 * 示例：feat(collamind): 支持节点增量布局计算
 */
const SCOPES = [
  'collacore',
  'collamind',
  'collamarkdown',
  'root',
  'deps',
  'ci',
  'release',
];

const TYPES = [
  'feat',
  'fix',
  'docs',
  'refactor',
  'perf',
  'test',
  'build',
  'ci',
  'chore',
  'revert',
];

module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', TYPES],
    'scope-enum': [2, 'always', SCOPES],
    'subject-case': [0],
    'header-max-length': [2, 'always', 100],
  },
};
