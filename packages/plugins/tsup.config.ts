import { defineConfig } from 'tsup';

export default defineConfig({
  clean: true,
  dts: true,
  entry: {
    agents: 'src/agents/index.ts',
    index: 'src/index.ts'
  },
  external: ['@agentsy/types'],
  format: ['esm', 'cjs'],
  sourcemap: true,
  splitting: false,
  target: 'es2022'
});
