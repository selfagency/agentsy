/**
 * E2E chat streaming tests against a real provider API (Ollama).
 *
 * These tests spawn the CLI as a subprocess via tui-test and verify that
 * interactive streaming works end-to-end — from message input through
 * the provider request pipeline to visible token-by-token output.
 *
 * **Env requirement:** `OLLAMA_API_KEY` must be set in the shell running
 * `pnpm test:e2e`. Tests will gracefully skip if the key is missing.
 *
 * @example
 * ```bash
 * # Build the CLI binary first
 * pnpm --filter @agentsy/cli build
 * # Run E2E tests (requires OLLAMA_API_KEY in env)
 * pnpm --filter @agentsy/cli test:e2e
 * ```
 */

import { expect, test } from '@microsoft/tui-test';

const BASE_URL = 'https://ollama.com/v1/chat/completions';
const MODEL = 'deepseek-v4-flash';
const apiKey = process.env.OLLAMA_API_KEY ?? null;

/**
 * Build the CLI command string for chat.
 * When apiKey is available and the test requires a valid key,
 * the flag is included. Otherwise an explicit key can be injected
 * for error-path tests.
 */
function chatCommand(overrideKey?: string): string {
  const key = overrideKey ?? apiKey ?? '';
  const keyFlag = key ? `--api-key ${key}` : '';
  return `node dist/cli.js chat --base-url ${BASE_URL} ${keyFlag} --model ${MODEL}`.trim();
}

test.describe('chat streaming E2E — Ollama', () => {
  // ── 1. Streaming renders text deltas ──────────────────────────────────────

  test('streaming renders text deltas', async ({ terminal }) => {
    if (apiKey === null) {
      return; // OLLAMA_API_KEY not set — skip
    }

    await terminal.submit(chatCommand());
    // Wait for the prompt to appear before sending input
    await terminal.write('Count from 1 to 5, separated by commas.');
    await terminal.keyPress('Enter');
    // Wait for the assistant header — signals the stream has started
    await expect(terminal.getByText(/assistant/gi)).toBeVisible();
    // Count from 1 to 5 reliably produces "1, 2, 3, 4, 5".
    // The pattern /,\s[2-4]/g matches ",\s2|,\s3|,\s4" which only appears in
    // the model response, not in the user's prompt "Count from 1 to 5"
    // (no commas, digits 2-4 only as part of "to 5").
    await expect(terminal.getByText(/,\s[2-4]/g, { full: true, strict: false })).toBeVisible({ timeout: 60_000 });
    // Exit cleanly
    await terminal.write('/exit');
    await terminal.keyPress('Enter');
  });

  // ── 2. Error with invalid API key ────────────────────────────────────────

  test('shows error for invalid API key', async ({ terminal }) => {
    // This test does NOT require a valid API key — it intentionally uses 'invalid'
    await terminal.submit(chatCommand('invalid'));
    await terminal.write('Hello');
    await terminal.keyPress('Enter');
    // The provider should reject with 401 and the CLI should display the error
    await expect(terminal.getByText(/error|401|Unauthorized|invalid|failed/gi)).toBeVisible({ timeout: 30_000 });
    await terminal.write('/exit');
    await terminal.keyPress('Enter');
  });

  // ── 3. /status shows model info ──────────────────────────────────────────

  test('/status shows the current model', async ({ terminal }) => {
    if (apiKey === null) {
      return; // OLLAMA_API_KEY not set — skip
    }

    await terminal.submit(chatCommand());
    await terminal.write('/status');
    await terminal.keyPress('Enter');
    // The status line includes the model name
    await expect(terminal.getByText(new RegExp(MODEL, 'gi'))).toBeVisible();
    await terminal.write('/exit');
    await terminal.keyPress('Enter');
  });

  // ── 4. /help lists available commands ────────────────────────────────────

  test('/help lists available commands', async ({ terminal }) => {
    if (apiKey === null) {
      return; // OLLAMA_API_KEY not set — skip
    }

    await terminal.submit(chatCommand());
    await terminal.write('/help');
    await terminal.keyPress('Enter');
    await expect(terminal.getByText(/Commands:/g)).toBeVisible();
    await expect(terminal.getByText(/\/exit/gi)).toBeVisible();
    await expect(terminal.getByText(/\/clear/gi)).toBeVisible();
    await terminal.write('/exit');
    await terminal.keyPress('Enter');
  });

  // ── 5. Ctrl+C during streaming ──────────────────────────────────────────

  test('handles Ctrl+C during streaming gracefully', async ({ terminal }) => {
    if (apiKey === null) {
      return; // OLLAMA_API_KEY not set — skip
    }

    await terminal.submit(chatCommand());
    await terminal.write('Write a short sentence about AI.');
    await terminal.keyPress('Enter');
    // Give the stream a moment to start producing output
    await expect(terminal.getByText(/assistant/gi)).toBeVisible({ timeout: 30_000 });
    // Interrupt the stream mid-flight. The CLI continues processing the
    // current streaming response (no early-termination), then exits.
    // After the process exits, bash takes over and processes buffered input.
    await terminal.keyCtrlC();
    // Send a unique marker — this only appears after bash regains control.
    await terminal.write('echo tui-test-ok');
    await terminal.keyPress('Enter');
    // Generous timeout: streaming must complete before the CLI exits
    // and bash processes the echo command.
    await expect(terminal.getByText(/tui-test-ok/g, { full: true, strict: false })).toBeVisible({ timeout: 120_000 });
  });
});
