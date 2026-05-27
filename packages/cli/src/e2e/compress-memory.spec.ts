import { test, expect } from '@microsoft/tui-test';

test.describe('compress-memory command', () => {
  test('compresses a file and reports savings', async ({ terminal }) => {
    const dir = '/tmp/agentsy-e2e-compress-memory';
    const file = `${dir}/CLAUDE.md`;

    await terminal.submit(`mkdir -p ${dir}`);
    await terminal.submit(`echo 'line1\nline2\nline3\n' > ${file}`);
    await terminal.submit(`node dist/cli.js compress-memory --file ${file}`);
    await expect(terminal.getByText(/Savings:/)).toBeVisible();
  });

  test('creates a .original.md backup file', async ({ terminal }) => {
    const dir = '/tmp/agentsy-e2e-compress-memory-backup';
    const file = `${dir}/CLAUDE.md`;

    await terminal.submit(`mkdir -p ${dir}`);
    await terminal.submit(`echo 'original content here\n' > ${file}`);
    await terminal.submit(`node dist/cli.js compress-memory --file ${file}`);
    await terminal.submit(`test -f ${file}.original.md && echo 'BACKUP_EXISTS'`);
    await expect(terminal.getByText('BACKUP_EXISTS')).toBeVisible();
  });

  test('shows error when --file is missing', async ({ terminal }) => {
    await terminal.submit('node dist/cli.js compress-memory');
    await expect(terminal.getByText('Missing --file for compress-memory command.')).toBeVisible();
  });
});
