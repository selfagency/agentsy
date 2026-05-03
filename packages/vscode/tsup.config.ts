import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts'
  },
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  target: 'es2022',
  external: ['vscode', '@selfagency/llm-stream-parser']
});
