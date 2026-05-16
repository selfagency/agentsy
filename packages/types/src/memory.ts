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

/**
 * Path in the agent filesystem.
 */

/**
 * Single entry in the agent filesystem.
 */
export interface AgentFsEntry {
  /** Full path including filename. */
  readonly path: string;
  /** UTF-8 string content. */
  readonly content: string;
  /** SHA-256 hash of the content. */
  readonly contentHash: string;
  /** Unix timestamp (ms) when created. */
  readonly createdAt: number;
  /** Unix timestamp (ms) when last updated. */
  readonly updatedAt: number;
}

/**
 * Options for creating an AgentFS manager.
 */
export interface AgentFsOptions {
  /** Optional namespace for isolating filesystems. */
  readonly namespace?: string;
}

/**
 * Management interface for the agent virtual filesystem.
 */
export interface AgentFsManager {
  /** Current namespace. */
  readonly namespace: string;
  /** Read an entry by its path. */
  read(path: string): AgentFsEntry | undefined;
  /** Write content to a path, creating or updating the entry. */
  write(path: string, content: string): AgentFsEntry;
  /** Delete a path from the filesystem. */
  delete(path: string): boolean;
  /** List all entries in the filesystem. */
  list(): AgentFsEntry[];
  /** Check if a path exists. */
  has(path: string): boolean;
  /** Remote all entries. */
  clear(): void;
  /** Bulk import existing entries, preserving timestamps. */
  import(entries: AgentFsEntry[]): void;
}
