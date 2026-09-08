/**
 * lint-staged：只对「本次改动涉及的子包」跑校验。
 * 用函数形式而非字符串，避免 lint-staged 把文件名追加到命令末尾
 * （tsc --noEmit 需要整个 project，不能只传单个文件）。
 */
const PACKAGE_PATH = /packages[\\/]([^\\/]+)[\\/]/;

/** 从「可能是绝对路径」的暂存文件里取出子包名，如 packages/collamind/src/index.ts -> collamind */
const changedPackages = (files) => [
  ...new Set(files.map((file) => PACKAGE_PATH.exec(file)?.[1]).filter(Boolean)),
];

module.exports = {
  'packages/*/src/**/*.ts': (files) =>
    changedPackages(files).map((pkg) => `pnpm --filter @collaflow/${pkg} run typecheck`),
  'packages/*/tests/**/*.ts': (files) =>
    changedPackages(files).map((pkg) => `pnpm --filter @collaflow/${pkg} run test`),
};
