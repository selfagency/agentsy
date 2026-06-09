import { expect, test } from '@microsoft/tui-test';

test.describe('doctor command', () => {
  test('prints diagnostics summary', async ({ terminal }) => {
    await terminal.submit('node dist/cli.js doctor memory');
    await expect(terminal.getByText(/memory: PASS/g)).toBeVisible();
  });
});
