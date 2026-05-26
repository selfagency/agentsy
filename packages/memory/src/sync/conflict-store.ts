import type { ConflictRecord, ConflictStore } from './types.js';

class InMemoryConflictStore implements ConflictStore {
  readonly #conflicts = new Map<string, ConflictRecord>();

  save(conflict: ConflictRecord): void {
    this.#conflicts.set(conflict.id, conflict);
  }

  get(id: string): ConflictRecord | null {
    return this.#conflicts.get(id) ?? null;
  }

  list(): ConflictRecord[] {
    return [...this.#conflicts.values()];
  }

  resolve(id: string): void {
    this.#conflicts.delete(id);
  }

  pendingCount(): number {
    return this.#conflicts.size;
  }
}

export function createConflictStore(): ConflictStore {
  return new InMemoryConflictStore();
}
