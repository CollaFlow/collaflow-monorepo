import { fileURLToPath } from 'node:url';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.EXPORT_STATIC === 'true' ? 'export' : undefined,
  distDir: process.env.EXPORT_STATIC === 'true' ? 'dist' : '.next',
  images: {
    unoptimized: process.env.EXPORT_STATIC === 'true',
  },
  // 转译 workspace 包（含 ESM 依赖如 Milkdown），避免 Next 直接引用未转译产物
  transpilePackages: ['@collaflow/markdown', '@collaflow/design'],
  // 关闭开发模式左下角的 Next.js 指示器
  devIndicators: false,
  // 显式声明 monorepo 根目录，避免 Next 误把用户主目录当成 workspace root
  // （否则会因主目录下的 yarn.lock 与项目 pnpm-lock.yaml 冲突而告警）
  outputFileTracingRoot: fileURLToPath(new URL('../..', import.meta.url)),
};

export default nextConfig;
