import type { ConflictRecord, ConflictStore } from "./types.js";

class InMemoryConflictStore implements ConflictStore {
  readonly #conflicts = new Map<string, ConflictRecord>();

  async save(conflict: ConflictRecord): Promise<void> {
    this.#conflicts.set(conflict.id, conflict);
  }

  async get(id: string): Promise<ConflictRecord | null> {
    return this.#conflicts.get(id) ?? null;
  }

  async list(): Promise<ConflictRecord[]> {
    return [...this.#conflicts.values()];
  }

  async resolve(id: string): Promise<void> {
    this.#conflicts.delete(id);
  }

  async pendingCount(): Promise<number> {
    return this.#conflicts.size;
  }
}

export function createConflictStore(): ConflictStore {
  return new InMemoryConflictStore();
}
