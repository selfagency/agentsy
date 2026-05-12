import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm', 'cjs'],
  dts: {
    resolve: false,
  },
  sourcemap: true,
  clean: true,
  splitting: false,
  target: 'es2022',
  external: ['@agentsy/core/structured', '@agentsy/core/thinking', '@agentsy/core/tool-calls'],
});
