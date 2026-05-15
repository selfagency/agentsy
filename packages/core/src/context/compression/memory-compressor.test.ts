import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { compressMemoryFile, isSensitivePath } from './memory-compressor.js';

describe('isSensitivePath', () => {
  it('detects known sensitive filenames and paths', () => {
    expect(isSensitivePath('/tmp/.env')).toBe(true);
    expect(isSensitivePath('/Users/me/.ssh/id_rsa')).toBe(true);
    expect(isSensitivePath('/workspace/credentials.yml')).toBe(true);
  });

  it('allows normal documentation paths', () => {
    expect(isSensitivePath('/workspace/CLAUDE.md')).toBe(false);
    expect(isSensitivePath('/workspace/docs/notes.md')).toBe(false);
  });
});

describe('compressMemoryFile', () => {
  it('creates backup and preserves code/url regions while compressing prose', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agentsy-memory-compress-'));
    const filePath = join(dir, 'CLAUDE.md');

    const input = [
      'This is basically a very simple memory file that actually repeats filler words.',
      'Run `pnpm test` before release.',
      'See https://example.com/runbook for details.',
      '```ts\nconst status = "ok";\nconsole.log(status);\n```',
    ].join('\n\n');

    await writeFile(filePath, input, 'utf8');

    const result = await compressMemoryFile(filePath, { backup: true });

    expect(result.compressed.length).toBeLessThan(result.original.length);
    expect(result.compressed).toContain('`pnpm test`');
    expect(result.compressed).toContain('https://example.com/runbook');
    expect(result.compressed).toContain('```ts\nconst status = "ok";\nconsole.log(status);\n```');

    const updated = await readFile(filePath, 'utf8');
    expect(updated).toBe(result.compressed);

    const backupPath = `${filePath}.original.md`;
    const backup = await readFile(backupPath, 'utf8');
    expect(backup).toBe(input);
  });

  it('refuses to compress sensitive paths', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agentsy-memory-sensitive-'));
    const filePath = join(dir, '.env');
    await writeFile(filePath, 'API_KEY=secret', 'utf8');

    await expect(compressMemoryFile(filePath)).rejects.toThrow('Refusing to compress sensitive path');
  });
});
