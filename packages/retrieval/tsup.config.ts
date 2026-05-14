import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ['@agentsy/core', '@agentsy/types', 'zod'],
  splitting: false,
  treeshake: true,
  minify: false,
  target: 'node18',
});