import { expect, test } from '@microsoft/tui-test';

test.describe('compress command', () => {
  test('compresses inline text with --text flag', async ({ terminal }) => {
    await terminal.submit(`node dist/cli.js compress --level full --text 'very very verbose verbose text'`);
    await expect(terminal.getByText(/Savings:/g)).toBeVisible();
  });

  test('supports all three compression levels', async ({ terminal }) => {
    for (const level of ['lite', 'full', 'ultra']) {
      await terminal.submit(
        `node dist/cli.js compress --level ${level} --text 'redundant redundant text that repeats itself over and over again'`
      );
      await expect(terminal.getByText(/Savings:/g)).toBeVisible();
    }
  });

  test('shows error for invalid compression level', async ({ terminal }) => {
    await terminal.submit("node dist/cli.js compress --level invalid --text 'some text'");
    await expect(terminal.getByText('Invalid --level value. Use one of: lite, full, ultra.')).toBeVisible();
  });

  test('shows error when missing input text', async ({ terminal }) => {
    await terminal.submit('node dist/cli.js compress --level full');
    await expect(terminal.getByText('Missing input. Provide --text or --file.')).toBeVisible();
  });

  test('reports a numeric savings percentage', async ({ terminal }) => {
    await terminal.submit("node dist/cli.js compress --level ultra --text 'a a a b b b c c c'");
    const savingsLine = terminal.getByText(/Savings: \d+\.\d+%/g);
    await expect(savingsLine).toBeVisible();
  });
});
