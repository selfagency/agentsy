import type { MemoryItem, TierConfig, TierLevel, TierName, TierReadQuery, TierReadResult } from './tier-types.js';
import { TIER_LEVELS, TIER_NAMES } from './tier-types.js';

export interface MemoryTierLike {
  capacity(): { usedTokens: number; maxTokens: number; usedItems: number; maxItems: number };
  clear(): void;
  readonly config: TierConfig;
  demote(count: number, from: MemoryTierLike): number;
  evict(count: number): MemoryItem[];
  items(): readonly MemoryItem[];
  readonly level: TierLevel;
  readonly name: TierName;
  promote(count: number, to: MemoryTierLike): number;
  read(query?: TierReadQuery): TierReadResult;
  write(item: MemoryItem): MemoryItem | null;
}

export interface MemoryTierOptions {
  config: TierConfig;
  now?: (() => number) | undefined;
}

export function createMemoryTier(options: MemoryTierOptions): MemoryTierLike {
  const now = options.now ?? (() => performance.now());
  const { config } = options;
  const items = new Map<string, MemoryItem>();

  let usedTokens = 0;

  function isExpired(item: MemoryItem): boolean {
    if (config.ttlMs === Number.POSITIVE_INFINITY) {
      return false;
    }
    return now() - item.createdAt > config.ttlMs;
  }

  function evictExpired(): void {
    for (const [id, item] of items) {
      if (isExpired(item)) {
        usedTokens -= item.tokenCount;
        items.delete(id);
      }
    }
  }

  function sortByPromotionPriority(item: MemoryItem): number {
    const age = now() - item.createdAt;
    const recencyWeight = 1 / (1 + age / 1000);
    return item.importance * recencyWeight * (1 + item.accessCount * 0.1);
  }

  return {
    config,

    get level() {
      return config.level;
    },

    get name() {
      return config.name;
    },

    write(item: MemoryItem): MemoryItem | null {
      evictExpired();

      if (items.has(item.id)) {
        return null;
      }
      if (config.maxItems !== Number.POSITIVE_INFINITY && items.size >= config.maxItems) {
        return null;
      }
      if (config.maxTokens !== Number.POSITIVE_INFINITY && usedTokens + item.tokenCount > config.maxTokens) {
        return null;
      }

      items.set(item.id, { ...item });
      usedTokens += item.tokenCount;
      return item;
    },

    read(query: TierReadQuery = {}): TierReadResult {
      evictExpired();

      let result = [...items.values()];

      if (query.minImportance !== undefined) {
        const threshold = query.minImportance;
        result = result.filter(i => i.importance >= threshold);
      }
      if (query.kind !== undefined) {
        const kind = query.kind;
        result = result.filter(i => i.kind === kind);
      }
      if (query.writeHeap !== undefined) {
        const heap = query.writeHeap;
        result = result.filter(i => i.writeHeap === heap);
      }

      result.sort((a, b) => b.importance - a.importance);

      const overflowed = query.limit !== undefined && result.length > query.limit;
      if (query.limit !== undefined) {
        result = result.slice(0, query.limit);
      }

      const tokenCount = result.reduce((sum, i) => sum + i.tokenCount, 0);

      return { items: result, overflowed, tierName: config.name, tokenCount };
    },

    capacity() {
      return {
        maxItems: config.maxItems,
        maxTokens: config.maxTokens,
        usedItems: items.size,
        usedTokens
      };
    },

    evict(count: number): MemoryItem[] {
      evictExpired();

      const sorted = [...items.values()].sort((a, b) => a.importance - b.importance);
      const toEvict = sorted.slice(0, count);

      for (const item of toEvict) {
        items.delete(item.id);
        usedTokens -= item.tokenCount;
      }

      return toEvict;
    },

    promote(count: number, to: MemoryTierLike): number {
      evictExpired();

      const sorted = [...items.values()].sort((a, b) => sortByPromotionPriority(b) - sortByPromotionPriority(a));

      let promoted = 0;
      for (const item of sorted) {
        if (promoted >= count) {
          break;
        }

        const written = to.write({
          ...item,
          lastAccessedAt: now(),
          accessCount: item.accessCount + 1
        });

        if (written !== null) {
          items.delete(item.id);
          usedTokens -= item.tokenCount;
          promoted++;
        }
      }

      return promoted;
    },

    demote(count: number, from: MemoryTierLike): number {
      const sorted = [...from.items()].sort((a, b) => a.importance - b.importance);
      let demoted = 0;

      for (const item of sorted) {
        if (demoted >= count) {
          break;
        }

        const written = this.write({
          ...item,
          lastAccessedAt: now(),
          accessCount: item.accessCount + 1
        });

        if (written !== null) {
          demoted++;
        }
      }

      return demoted;
    },

    clear(): void {
      items.clear();
      usedTokens = 0;
    },

    items(): readonly MemoryItem[] {
      return [...items.values()];
    }
  };
}

export function nextTierName(current: TierName): TierName | null {
  // nosemgrep: typescript.lang.security.detect-object-injection.detect-object-injection -- constant enum lookup, not user input
  const level = TIER_LEVELS[current];
  if (level >= 5) {
    return null;
  }
  // nosemgrep: typescript.lang.security.detect-object-injection.detect-object-injection -- constant enum lookup, not user input
  return TIER_NAMES[(level + 1) as TierLevel] ?? null;
}

export function prevTierName(current: TierName): TierName | null {
  // nosemgrep: typescript.lang.security.detect-object-injection.detect-object-injection -- constant enum lookup, not user input
  const level = TIER_LEVELS[current];
  if (level <= 1) {
    return null;
  }
  // nosemgrep: typescript.lang.security.detect-object-injection.detect-object-injection -- constant enum lookup, not user input
  return TIER_NAMES[(level - 1) as TierLevel] ?? null;
}
