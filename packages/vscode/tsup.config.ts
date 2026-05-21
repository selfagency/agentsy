import { defineConfig } from 'tsup';

export default defineConfig({
  clean: true,
  dts: true,
  entry: {
    index: 'src/index.ts',
    'api-key-manager': 'src/api-key-manager/index.ts',
    'stream-bridge': 'src/stream-bridge/index.ts',
    'vscode-renderer': 'src/vscode-renderer/index.ts',
    mcp: 'src/mcp/index.ts',
    'message-conversion': 'src/message-conversion/index.ts'
  },
  external: ['vscode'],
  format: ['esm', 'cjs'],
  sourcemap: true,
  splitting: false,
  target: 'es2022'
});
