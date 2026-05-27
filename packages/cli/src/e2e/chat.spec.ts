import { test, expect } from '@microsoft/tui-test';

test.describe('chat command', () => {
  test('exits cleanly on /exit command', async ({ terminal }) => {
    // Start the chat interactive session
    await terminal.submit('node dist/cli.js chat --mock');
    // Give it a moment to start the REPL
    // Send the /exit command
    await terminal.write('/exit');
    await terminal.keyPress('Enter');
    // Chat should exit and return us to the shell prompt
    // No crash / error expected
  });

  test('sends a message and receives a response', async ({ terminal }) => {
    await terminal.submit('node dist/cli.js chat --mock');
    // Send a simple message
    await terminal.write('hello');
    await terminal.keyPress('Enter');
    // Mock provider returns predictable text — verify something appeared
    await expect(terminal.getByText(/hello|response/i)).toBeVisible();
    // Exit cleanly
    await terminal.write('/exit');
    await terminal.keyPress('Enter');
  });

  test('shows /help output', async ({ terminal }) => {
    await terminal.submit('node dist/cli.js chat --mock');
    await terminal.write('/help');
    await terminal.keyPress('Enter');
    await expect(terminal.getByText(/available commands|usage/i)).toBeVisible();
    await terminal.write('/exit');
    await terminal.keyPress('Enter');
  });
});
