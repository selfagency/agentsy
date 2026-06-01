import { defineConfig } from '@microsoft/tui-test';

export default defineConfig({
  /**
   * Per-test timeout (ms). Generous to accommodate Ollama model latency.
   */
  timeout: 120_000,

  /**
   * Retry flaky tests up to 2 times.
   */
  retries: 2,

  /**
   * Capture VT traces for failure debugging.
   */
  trace: true,

  /**
   * Test file pattern — discover all .spec.ts files in src/e2e/.
   */
  testMatch: ['src/e2e/**/*.spec.ts'],

  /**
   * Use bash as the shell for terminal tests.
   * tui-test v0.0.4 on macOS/zsh has a bug where ZDOTDIR is set to a temp
   * directory but the zsh shell integration dotfiles are never written unless
   * tests explicitly declare `options.shell: 'zsh'`. Bash always gets proper
   * shell integration via --init-file.
   */
  use: {
    shell: 'bash'
  }
});
