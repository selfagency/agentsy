import { expect, test } from '@microsoft/tui-test';

test.describe('setup command', () => {
  test('prints setup guidance', async ({ terminal }) => {
    await terminal.submit('node dist/cli.js setup memory');
    await expect(
      terminal.getByText(/memory: Configure the local database path and optional sync settings./g)
    ).toBeVisible();
  });
});
