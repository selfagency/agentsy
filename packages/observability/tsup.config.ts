import { defineConfig } from 'tsup';

export default defineConfig({
  clean: true,
  dts: true,
  entry: {
    index: 'src/index.ts',
    instrumentation: 'src/instrumentation/index.ts',
    exporters: 'src/exporters/index.ts',
    spans: 'src/spans/agent-span.ts'
  },
  format: ['esm', 'cjs'],
  sourcemap: true,
  splitting: false,
  target: 'es2022'
});
