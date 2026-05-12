import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    processor: 'src/processor/index.ts',
    adapters: 'src/adapters/index.ts',
    context: 'src/context/index.ts',
    formatting: 'src/formatting/index.ts',
    normalizers: 'src/normalizers/index.ts',
    'xml-filter': 'src/xml-filter/index.ts',
    recovery: 'src/recovery/index.ts',
    retry: 'src/retry/index.ts',
    sse: 'src/sse/index.ts',
    structured: 'src/structured/index.ts',
    thinking: 'src/thinking/index.ts',
    'tool-calls': 'src/tool-calls/index.ts',
    'universal-client': 'src/universal-client/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ['@agentsy/types', 'zod'],
  splitting: false,
  treeshake: true,
  minify: false,
  target: 'node18',
});
