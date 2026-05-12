import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/normalizers/index.ts', 'src/universal-client/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ['@agentsy/types'],
});
