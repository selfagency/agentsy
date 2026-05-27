import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.ts',
        '**/*.spec.ts',
        'src/test/',
        'src/testing/',
        '**/*.sqlite.test.ts'
      ],
      provider: 'v8',
      reporter: ['text', 'lcov'],
      thresholds: {
        branches: 76,
        functions: 80,
        lines: 80,
        statements: 80
      }
    },
    environment: 'node',
    exclude: ['node_modules', 'dist'],
    globals: true,
    include: ['src/**/*.test.ts']
  }
});
