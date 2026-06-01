import type { ConflictRecord, ConflictStore } from './types.js';

class InMemoryConflictStore implements ConflictStore {
  readonly #conflicts = new Map<string, ConflictRecord>();

  save(conflict: ConflictRecord): Promise<void> {
    this.#conflicts.set(conflict.id, conflict);
    return Promise.resolve();
  }

  get(id: string): Promise<ConflictRecord | null> {
    return Promise.resolve(this.#conflicts.get(id) ?? null);
  }

  list(): Promise<ConflictRecord[]> {
    return Promise.resolve([...this.#conflicts.values()]);
  }

  resolve(id: string): Promise<void> {
    this.#conflicts.delete(id);
    return Promise.resolve();
  }

  pendingCount(): Promise<number> {
    return Promise.resolve(this.#conflicts.size);
  }
}

export function createConflictStore(): ConflictStore {
  return new InMemoryConflictStore();
}
