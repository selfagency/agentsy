import { defineConfig } from 'tsup';

export default defineConfig({
  clean: true,
  dts: true,
  entry: {
    adapters: 'src/adapters/index.ts',
    index: 'src/index.ts',
    normalizers: 'src/normalizers/index.ts',
    pipeline: 'src/pipeline/index.ts',
    'request-path': 'src/request-path.ts',
    'universal-client': 'src/universal-client/index.ts'
  },
  external: [
    '@agentsy/core',
    '@agentsy/core/processor',
    '@agentsy/core/structured',
    '@agentsy/core/tool-calls',
    '@agentsy/types',
    'zod'
  ],
  format: ['esm', 'cjs'],
  minify: false,
  sourcemap: true,
  splitting: false,
  target: 'node18',
  treeshake: true
});
