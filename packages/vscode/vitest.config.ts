import path from 'node:path';

import { defineConfig } from 'vitest/config';

const __dirname = import.meta.dirname;

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      vscode: path.resolve(__dirname, './src/test/mocks/vscode.ts')
    }
  },
  test: {
    coverage: {
      exclude: ['node_modules/', 'dist/', '**/*.test.ts', '**/*.spec.ts', 'src/test/fixtures', 'src/test/integration'],
      thresholds: {
        functions: 90,
        lines: 90,
        statements: 90
      },
      provider: 'v8',
      reporter: ['text', 'lcov']
    },
    environment: 'node',
    exclude: ['node_modules', 'dist'],
    globals: true,
    include: ['src/**/*.test.ts']
  }
});
