import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { describe, expect, it } from 'vitest';

import { compressMemoryFile } from './index.js';

describe('compressMemoryFile', () => {
  it('creates a backup and preserves fenced code blocks', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agentsy-memory-compress-'));

    try {
      const filePath = join(dir, 'CLAUDE.md');
      const source = [
        '# Memory Notes',
        '',
        'This is intentionally verbose text that should be compressed.',
        'This is intentionally verbose text that should be compressed.',
        '',
        '```json',
        '{"a":1}',
        '```'
      ].join('\n');

      await writeFile(filePath, source, 'utf8');

      const result = await compressMemoryFile(filePath, {
        backup: true,
        writeCompressed: true
      });

      const rewritten = await readFile(filePath, 'utf8');
      const backup = await readFile(`${filePath}.original.md`, 'utf8');

      expect(result.original).toBe(source);
      expect(result.compressed).toContain('```json');
      expect(result.compressed).toContain('{"a":1}');
      expect(result.savingsRatio).toBeGreaterThanOrEqual(0);
      expect(rewritten).toBe(result.compressed);
      expect(backup).toBe(source);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
