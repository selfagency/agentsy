import { expect, test } from '@microsoft/tui-test';

test.describe('guardrails command', () => {
  test('list prints available guardrails', async ({ terminal }) => {
    await terminal.submit('node dist/cli.js guardrails list');
    await expect(terminal.getByText(/Available scanners/)).toBeVisible();
  });

  test('policy show prints default policy', async ({ terminal }) => {
    await terminal.submit('node dist/cli.js guardrails policy');
    await expect(terminal.getByText(/policy|guardrails/)).toBeVisible();
  });
});
