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
  level: TierLevel;
  name: TierName;
  maxTokens: number;
  maxItems: number;
  ttlMs: number;
  consolidationThreshold: number;
  compressionTarget: number;
}

export interface MemoryItem {
  id: string;
  kind: MemoryKind;
  content: string;
  tokenCount: number;
  importance: number;
  writeHeap: WriteHeap;
  reuseClass: ReuseClass;
  createdAt: number;
  lastAccessedAt: number;
  accessCount: number;
  fingerprint: string;
  metadata: Record<string, unknown>;
}

export interface TierReadQuery {
  minImportance?: number;
  kind?: MemoryKind;
  writeHeap?: WriteHeap;
  limit?: number;
}

export interface TierReadResult<T = MemoryItem> {
  items: T[];
  tierName: TierName;
  tokenCount: number;
  overflowed: boolean;
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
