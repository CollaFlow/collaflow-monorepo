import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/bin/collaflow.ts'],
  format: ['cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  target: 'node20',
  shims: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
});
