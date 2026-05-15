import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { name, runCli } from './index.js';

describe('cli package scaffold', () => {
  it('exports the package name', () => {
    expect(name).toBe('cli');
  });

  it('runs compress command with inline --text input', async () => {
    const stdout: string[] = [];

    const exitCode = await runCli(['compress', '--level', 'full', '--text', 'very very verbose verbose text'], {
      stdout: value => {
        stdout.push(value);
      },
      stderr: () => {
        // no-op
      }
    });

    expect(exitCode).toBe(0);
    expect(stdout.join('\n')).toContain('Savings:');
  });

  it('runs compress command for file input', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agentsy-cli-compress-'));
    const filePath = join(dir, 'response.md');
    await writeFile(filePath, 'This is basically a simple response with fluff.', 'utf8');

    const stdout: string[] = [];
    const stderr: string[] = [];

    const code = await runCli(['compress', '--file', filePath, '--level', 'full'], {
      stdout: (message: string) => {
        stdout.push(message);
      },
      stderr: (message: string) => {
        stderr.push(message);
      }
    });

    expect(code).toBe(0);
    expect(stderr).toEqual([]);
    expect(stdout.join('\n')).toContain('Savings:');
  });

  it('runs memory file compression command and preserves original as backup', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agentsy-cli-compress-'));

    try {
      const filePath = join(dir, 'CLAUDE.md');
      await writeFile(filePath, 'line\n\nline\n', 'utf8');

      const exitCode = await runCli(['compress-memory', '--file', filePath], {
        stdout: () => {
          // no-op
        },
        stderr: () => {
          // no-op
        }
      });
      const backup = await readFile(`${filePath}.original.md`, 'utf8');

      expect(exitCode).toBe(0);
      expect(backup).toBe('line\n\nline\n');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('runs compress-memory command and writes compressed file with backup', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agentsy-cli-memory-'));
    const filePath = join(dir, 'CLAUDE.md');
    await writeFile(filePath, 'This is basically a memory file that is actually verbose.', 'utf8');

    const stdout: string[] = [];

    const code = await runCli(['compress-memory', '--file', filePath], {
      stdout: (message: string) => {
        stdout.push(message);
      },
      stderr: () => {
        // no-op for test
      }
    });

    expect(code).toBe(0);

    const updated = await readFile(filePath, 'utf8');
    const backup = await readFile(`${filePath}.original.md`, 'utf8');

    expect(updated.length).toBeLessThanOrEqual(backup.length);
    expect(stdout.join('\n')).toContain('Savings:');
  });

  it('returns non-zero for unknown command', async () => {
    const stderr: string[] = [];
    const code = await runCli(['unknown-command'], {
      stdout: () => {
        // no-op
      },
      stderr: (message: string) => {
        stderr.push(message);
      }
    });

    expect(code).toBe(1);
    expect(stderr.join(' ')).toContain('Unknown command');
  });
});
