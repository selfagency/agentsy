import { defineConfig } from 'tsup';

export default defineConfig({
  clean: true,
  dts: true,
  entry: {
    'cortexkit/index': 'src/cortexkit/index.ts'
  },
  external: ['better-sqlite3'],
  format: ['esm', 'cjs'],
  sourcemap: true,
  target: 'es2022'
});
