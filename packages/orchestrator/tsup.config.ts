import { defineConfig } from 'tsup';

export default defineConfig({
  clean: true,
  entry: ['src/index.ts', 'src/agent/index.ts'],
  format: ['esm', 'cjs'],
  sourcemap: true,
  splitting: false,
  target: 'es2022'
});
