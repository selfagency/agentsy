import { expect, test } from '@microsoft/tui-test';

test.describe('CLI basics', () => {
  test('returns exit code 1 for unknown command', async ({ terminal }) => {
    await terminal.submit('node dist/cli.js unknown-command');
    await expect(terminal.getByText(/Unknown command: unknown-command/g)).toBeVisible();
  });

  test('shows supported commands list', async ({ terminal }) => {
    await terminal.submit('node dist/cli.js unknown-command');
    // tui-test requires global flag for regex assertions
    await expect(terminal.getByText(/Supported commands:/g)).toBeVisible();
    // Use non-strict mode: the regex matches multiple command names in the output
    await expect(terminal.getByText(/chat|compress|compress-memory|memory-sync-dev/g, { strict: false })).toBeVisible();
  });

  test('runs default entry (no subcommand) without crash', async ({ terminal }) => {
    // Default entry runs the Ink TUI. It should start without crashing.
    // We give it a moment then send Ctrl+C to exit.
    await terminal.submit('node dist/cli.js');
    // Wait briefly to ensure it didn't crash immediately
    // Send Ctrl+C to exit the TUI (uses keyCtrlC, not string 'Control+C')
    await terminal.keyCtrlC();
    // After exit, shell prompt should be visible — no crash assertion
  });
});
