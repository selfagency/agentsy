/**
 * Memory storage types.
 */

import type { MemoryId } from './brands.js';

/**
 * Memory record with content and metadata.
 */
export interface MemoryRecord {
  /** Memory identifier. */
  id: MemoryId;

  /** Stored content. */
  content: string;

  /** Optional metadata. */
  metadata?: Record<string, unknown>;

  /** Timestamp when record was created. */
  createdAt?: number;

  /** Timestamp when record was last updated. */
  updatedAt?: number;
}

/**
 * Memory store interface for persistence.
 */
export interface MemoryStore {
  /** Store a memory record. */
  put(record: MemoryRecord): void;

  /** Retrieve a memory record by ID. */
  get(id: MemoryId): MemoryRecord | undefined;

  /** List all memory records. */
  list(): MemoryRecord[];

  /** Search memory records by query. */
  search(query: string): MemoryRecord[];

  /** Remove a memory record. */
  delete(id: MemoryId): void;
}
