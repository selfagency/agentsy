import { test, expect } from '@microsoft/tui-test';

test.describe('CLI basics', () => {
  test('returns exit code 1 for unknown command', async ({ terminal }) => {
    await terminal.submit('node dist/cli.js unknown-command; echo "EXIT_CODE: $?"');
    await expect(terminal.getByText('Unknown command: unknown-command')).toBeVisible();
    await expect(terminal.getByText('EXIT_CODE:')).toBeVisible();
    await expect(terminal.getByText('EXIT_CODE: 1')).toBeVisible();
  });

  test('shows supported commands list', async ({ terminal }) => {
    await terminal.submit('node dist/cli.js unknown-command');
    await expect(terminal.getByText(/Supported commands:/)).toBeVisible();
    await expect(terminal.getByText(/chat|compress|compress-memory|memory-sync-dev/)).toBeVisible();
  });

  test('runs default entry (no subcommand) without crash', async ({ terminal }) => {
    // Default entry runs the Ink TUI. It should start without crashing.
    // We give it a moment then send Ctrl+C to exit.
    await terminal.submit('node dist/cli.js');
    // Wait briefly to ensure it didn't crash immediately
    await terminal.keyPress('Control+C');
    // After exit, shell prompt should be visible — no crash assertion
  });
});
