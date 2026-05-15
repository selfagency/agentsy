import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { name, runCli } from './index.js';

describe('cli package scaffold', () => {
  it('exports the package name', () => {
    expect(name).toBe('cli');
  });

  it('runs output compression command', async () => {
    const output: string[] = [];

    const exitCode = await runCli(['compress', '--level', 'full', '--text', 'very very verbose verbose text'], {
      stdout: value => {
        output.push(value);
      },
    });

    expect(exitCode).toBe(0);
    expect(output.join('\n')).toContain('Savings:');
  });

  it('runs memory file compression command and writes backup', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agentsy-cli-compress-'));

    try {
      const filePath = join(dir, 'CLAUDE.md');
      await writeFile(filePath, 'line\n\nline\n', 'utf8');

      const exitCode = await runCli(['compress-memory', '--file', filePath]);
      const backup = await readFile(`${filePath}.original.md`, 'utf8');

      expect(exitCode).toBe(0);
      expect(backup).toBe('line\n\nline\n');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
