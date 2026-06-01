import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: ['src/e2e/**', '.tui-test/**', 'node_modules/**', 'dist/**']
  }
});
