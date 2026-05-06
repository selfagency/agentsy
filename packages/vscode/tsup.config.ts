import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'renderer/index': 'src/vscode-renderer/index.ts',
    'mcp/index': 'src/mcp/index.ts',
    'mcp-integration/index': 'src/mcp-integration/index.ts',
    'retry/index': 'src/retry/index.ts',
    'stream-bridge/index': 'src/stream-bridge/index.ts',
    'vscode-overloads/index': 'src/vscode-overloads/index.ts',
    'api-key-manager/index': 'src/api-key-manager/index.ts',
    'settings/index': 'src/settings/index.ts',
    'error-handling/index': 'src/error-handling/index.ts',
    'testing/index': 'src/testing/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  target: 'es2022',
  external: ['vscode'],
});
