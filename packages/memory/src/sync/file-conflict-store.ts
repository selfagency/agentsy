import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import type { ConflictRecord, ConflictStore } from './types.js';

interface StoredConflictEnvelope {
  version: 1;
  conflicts: ConflictRecord[];
}

export interface FileConflictStoreOptions {
  filePath: string;
}

const EMPTY_ENVELOPE: StoredConflictEnvelope = {
  version: 1,
  conflicts: []
};

function cloneConflict<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createEmptyEnvelope(): StoredConflictEnvelope {
  return {
    version: EMPTY_ENVELOPE.version,
    conflicts: []
  };
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

function sortConflicts(conflicts: ConflictRecord[]): ConflictRecord[] {
  return [...conflicts].sort((left, right) => {
    if (left.detectedAt !== right.detectedAt) {
      return left.detectedAt.localeCompare(right.detectedAt);
    }

    return left.id.localeCompare(right.id);
  });
}

class FileConflictStore implements ConflictStore {
  #writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly options: FileConflictStoreOptions) {}

  async #withLock<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.#writeQueue.then(operation, operation);
    this.#writeQueue = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  }

  async #readEnvelope(): Promise<StoredConflictEnvelope> {
    try {
      const content = await readFile(this.options.filePath, 'utf8');
      const parsed = JSON.parse(content) as Partial<StoredConflictEnvelope>;

      if (!Array.isArray(parsed.conflicts)) {
        return createEmptyEnvelope();
      }

      return {
        version: 1,
        conflicts: sortConflicts(parsed.conflicts).map(conflict => cloneConflict(conflict))
      };
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return createEmptyEnvelope();
      }

      throw error;
    }
  }

  async #writeEnvelope(envelope: StoredConflictEnvelope): Promise<void> {
    await mkdir(dirname(this.options.filePath), { recursive: true });
    const temporaryPath = `${this.options.filePath}.${randomUUID()}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(envelope, null, 2)}\n`, 'utf8');
    await rename(temporaryPath, this.options.filePath);
  }

  async save(conflict: ConflictRecord): Promise<void> {
    await this.#withLock(async () => {
      const envelope = await this.#readEnvelope();
      const conflicts = envelope.conflicts.filter(current => current.id !== conflict.id);
      conflicts.push(cloneConflict(conflict));

      await this.#writeEnvelope({
        version: 1,
        conflicts: sortConflicts(conflicts)
      });
    });
  }

  async get(id: string): Promise<ConflictRecord | null> {
    const envelope = await this.#readEnvelope();
    const conflict = envelope.conflicts.find(current => current.id === id);
    return conflict ? cloneConflict(conflict) : null;
  }

  async list(): Promise<ConflictRecord[]> {
    const envelope = await this.#readEnvelope();
    return envelope.conflicts.map(conflict => cloneConflict(conflict));
  }

  async resolve(id: string): Promise<void> {
    await this.#withLock(async () => {
      const envelope = await this.#readEnvelope();
      await this.#writeEnvelope({
        version: 1,
        conflicts: envelope.conflicts.filter(conflict => conflict.id !== id)
      });
    });
  }

  async pendingCount(): Promise<number> {
    const envelope = await this.#readEnvelope();
    return envelope.conflicts.length;
  }
}

export function createFileConflictStore(options: FileConflictStoreOptions): ConflictStore {
  return new FileConflictStore(options);
}
