import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/thinking/index.ts',
    'src/xml-filter/index.ts',
    'src/tool-calls/index.ts',
    'src/context/index.ts',
    'src/processor/index.ts',
    'src/markdown/index.ts',
    'src/adapters/generic.ts',
    'src/adapters/vscode.ts',
  ],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  target: 'es2022',
});
