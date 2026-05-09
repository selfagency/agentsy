import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm', 'cjs'],
  sourcemap: true,
  clean: true,
  splitting: false,
  target: 'es2022',
});
