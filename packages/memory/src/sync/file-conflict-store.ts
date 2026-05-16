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
  conflicts: [],
  version: 1
};

function cloneConflict<T>(value: T): T {
  return structuredClone(value);
}

function createEmptyEnvelope(): StoredConflictEnvelope {
  return {
    conflicts: [],
    version: EMPTY_ENVELOPE.version
  };
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

function sortConflicts(conflicts: ConflictRecord[]): ConflictRecord[] {
  return [...conflicts].toSorted((left, right) => {
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
      () => {},
      () => {}
    );
    return next;
  }

  async #readEnvelope(): Promise<StoredConflictEnvelope> {
    try {
      const content = await readFile(this.options.filePath, 'utf-8');
      const parsed = JSON.parse(content) as Partial<StoredConflictEnvelope>;

      if (!Array.isArray(parsed.conflicts)) {
        return createEmptyEnvelope();
      }

      return {
        conflicts: sortConflicts(parsed.conflicts).map(conflict => cloneConflict(conflict)),
        version: 1
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
    await writeFile(temporaryPath, `${JSON.stringify(envelope, null, 2)}\n`, 'utf-8');
    await rename(temporaryPath, this.options.filePath);
  }

  async save(conflict: ConflictRecord): Promise<void> {
    await this.#withLock(async () => {
      const envelope = await this.#readEnvelope();
      const conflicts = envelope.conflicts.filter(current => current.id !== conflict.id);
      conflicts.push(cloneConflict(conflict));

      await this.#writeEnvelope({
        conflicts: sortConflicts(conflicts),
        version: 1
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
        conflicts: envelope.conflicts.filter(conflict => conflict.id !== id),
        version: 1
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
