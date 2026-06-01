import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/agent/index.ts'],
  format: ['esm', 'cjs'],
  sourcemap: true,
  clean: true,
  splitting: false,
  target: 'es2022'
});
