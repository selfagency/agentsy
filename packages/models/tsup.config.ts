import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  target: 'node20',
  dts: {
    resolve: true,
    tsconfig: {
      compilerOptions: {
        declaration: true,
        moduleResolution: 'bundler',
      },
    },
  },
  external: ['node-fetch'],
});
