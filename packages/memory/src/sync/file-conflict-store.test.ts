import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createFileConflictStore } from './file-conflict-store.js';
import type { ConflictRecord } from './types.js';

const temporaryDirectories: string[] = [];

function createConflict(id: string, detectedAt: string): ConflictRecord {
  return {
    id,
    recordId: 'record-1',
    tier: 'wiki',
    detectedAt,
    policy: 'manualRequired',
    local: {
      id: 'record-1',
      tier: 'wiki',
      updatedAt: '2026-05-15T10:00:00.000Z',
      content: 'local'
    },
    remote: {
      id: 'record-1',
      tier: 'wiki',
      updatedAt: '2026-05-15T10:05:00.000Z',
      content: 'remote'
    }
  };
}

async function createStorePath(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'agentsy-memory-conflicts-'));
  temporaryDirectories.push(directory);
  return join(directory, 'nested', 'conflicts.json');
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
});

describe('createFileConflictStore', () => {
  it('persists conflicts across store instances', async () => {
    const filePath = await createStorePath();
    const first = createFileConflictStore({ filePath });
    const second = createFileConflictStore({ filePath });

    await first.save(createConflict('conflict-2', '2026-05-15T10:02:00.000Z'));
    await first.save(createConflict('conflict-1', '2026-05-15T10:01:00.000Z'));

    await expect(second.pendingCount()).resolves.toBe(2);
    await expect(second.list()).resolves.toMatchObject([{ id: 'conflict-1' }, { id: 'conflict-2' }]);
  });

  it('removes resolved conflicts from disk', async () => {
    const filePath = await createStorePath();
    const store = createFileConflictStore({ filePath });

    await store.save(createConflict('conflict-1', '2026-05-15T10:01:00.000Z'));
    await store.resolve('conflict-1');

    await expect(store.get('conflict-1')).resolves.toBeNull();
    await expect(store.pendingCount()).resolves.toBe(0);
  });

  it('writes a versioned json envelope', async () => {
    const filePath = await createStorePath();
    const store = createFileConflictStore({ filePath });

    await store.save(createConflict('conflict-1', '2026-05-15T10:01:00.000Z'));

    const content = await readFile(filePath, 'utf8');
    expect(JSON.parse(content)).toMatchObject({
      version: 1,
      conflicts: [{ id: 'conflict-1' }]
    });
  });
});
