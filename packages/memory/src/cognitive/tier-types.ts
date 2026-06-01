export type TierLevel = 1 | 2 | 3 | 4 | 5;

export type TierName =
  | 'sensory_buffer'
  | 'sensory_register'
  | 'working_memory'
  | 'short_term_memory'
  | 'long_term_memory';

export type WriteHeap = 'event' | 'query' | 'doc' | 'ref';

export type MemoryKind = 'semantic' | 'episodic' | 'procedural' | 'sensory';

export type ReuseClass = 'hot' | 'warm' | 'cold';

export interface TierConfig {
  compressionTarget: number;
  consolidationThreshold: number;
  level: TierLevel;
  maxItems: number;
  maxTokens: number;
  name: TierName;
  ttlMs: number;
}

export interface MemoryItem {
  accessCount: number;
  content: string;
  createdAt: number;
  fingerprint: string;
  id: string;
  importance: number;
  kind: MemoryKind;
  lastAccessedAt: number;
  metadata: Record<string, unknown>;
  reuseClass: ReuseClass;
  tokenCount: number;
  writeHeap: WriteHeap;
}

export interface TierReadQuery {
  kind?: MemoryKind;
  limit?: number;
  minImportance?: number;
  writeHeap?: WriteHeap;
}

export interface TierReadResult<T = MemoryItem> {
  items: T[];
  overflowed: boolean;
  tierName: TierName;
  tokenCount: number;
}

export const TIER_LEVELS: Record<TierName, TierLevel> = {
  sensory_buffer: 1,
  sensory_register: 2,
  working_memory: 3,
  short_term_memory: 4,
  long_term_memory: 5
};

export const TIER_NAMES: Record<TierLevel, TierName> = {
  1: 'sensory_buffer',
  2: 'sensory_register',
  3: 'working_memory',
  4: 'short_term_memory',
  5: 'long_term_memory'
};
