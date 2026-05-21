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
      exclude: ['node_modules/', 'dist/', '**/*.test.ts', '**/*.spec.ts', 'src/test/', 'src/testing/'],
      thresholds: {
        branches: 60,
        functions: 80,
        lines: 80,
        statements: 80
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
