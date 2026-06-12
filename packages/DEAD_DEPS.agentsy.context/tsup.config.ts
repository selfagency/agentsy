import { defineConfig } from 'tsup';

export default defineConfig({
  clean: true,
  dts: true,
  entry: { index: 'src/index.ts', budget: 'src/budget.ts' },
  format: ['esm', 'cjs'],
  sourcemap: true,
  splitting: false,
  target: 'es2022'
});
