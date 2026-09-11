import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  format: ['esm', 'cjs'],
  target: 'es2022',
  platform: 'browser',
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  // 将 katex 一同打包（含其 CSS），并由 esbuild 在运行时注入样式，
  // 使包自包含、不依赖消费方打包器对 CSS 的处理。
  injectStyle: true,
  noExternal: ['katex'],
});
