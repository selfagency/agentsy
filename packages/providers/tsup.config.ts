import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    adapters: 'src/adapters/index.ts',
    normalizers: 'src/normalizers/index.ts',
    pipeline: 'src/pipeline/index.ts',
    'universal-client': 'src/universal-client/index.ts'
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  external: [
    '@agentsy/core',
    '@agentsy/core/processor',
    '@agentsy/core/structured',
    '@agentsy/core/tool-calls',
    '@agentsy/types',
    'zod'
  ],
  splitting: false,
  treeshake: true,
  minify: false,
  target: 'node18'
});
