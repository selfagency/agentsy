import { test, expect } from '@microsoft/tui-test';

test.describe('memory-sync-dev command', () => {
  test('prints default development wiring', async ({ terminal }) => {
    await terminal.submit('node dist/cli.js memory-sync-dev');
    await expect(terminal.getByText(/tursodb .*local-sync-server\.db.*--sync-server/)).toBeVisible();
    await expect(terminal.getByText(/TURSO_DATABASE_URL=/)).toBeVisible();
  });

  test('prints wiring as JSON with --json flag', async ({ terminal }) => {
    await terminal.submit('node dist/cli.js memory-sync-dev --json');
    await expect(terminal.getByText(/"bindAddress":/)).toBeVisible();
    await expect(terminal.getByText(/"serverUrl":/)).toBeVisible();
    await expect(terminal.getByText(/"syncIntervalMs":/)).toBeVisible();
  });

  test('accepts custom flag values', async ({ terminal }) => {
    await terminal.submit(
      [
        'node dist/cli.js memory-sync-dev',
        '--server-db ./tmp/custom.db',
        '--replica-db ./tmp/custom-replica.db',
        '--server-url http://localhost:9090',
        '--bind 127.0.0.1:9090',
        '--sync-interval-ms 1500'
      ].join(' ')
    );
    await expect(terminal.getByText(/tursodb \.\/tmp\/custom\.db/)).toBeVisible();
    await expect(terminal.getByText(/TURSO_DATABASE_URL=http:\/\/localhost:9090/)).toBeVisible();
  });

  test('shows error for invalid sync-interval-ms value', async ({ terminal }) => {
    await terminal.submit(['node dist/cli.js memory-sync-dev', '--sync-interval-ms nope'].join(' '));
    await expect(terminal.getByText('Invalid --sync-interval-ms value. Use a positive number.')).toBeVisible();
  });
});
