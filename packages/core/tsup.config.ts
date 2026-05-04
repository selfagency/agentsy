import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'normalizers/index': 'src/normalizers/index.ts',
    'context/index': 'src/context/index.ts',
    'formatting/index': 'src/formatting/index.ts',
    'markdown/index': 'src/markdown/index.ts',
    'recovery/index': 'src/recovery/index.ts',
    'sse/index': 'src/sse/index.ts',
    'renderers/index': 'src/renderers/index.ts',
    'renderers/plain/index': 'src/renderers/plain/index.ts',
    'renderers/cli/index': 'src/renderers/cli/index.ts',
    'renderers/streaming-md/index': 'src/renderers/streaming-md/index.ts',
    'ui/index': 'src/ui/index.ts',
    'renderers/ink/index': 'src/renderers/ink/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  target: 'es2022',
});
