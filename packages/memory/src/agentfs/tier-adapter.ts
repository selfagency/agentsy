import { eq, like } from 'drizzle-orm';

import type { MemoryTierLike } from '../cognitive/memory-tier.js';
import type { MemoryItem, TierConfig, TierName, TierReadQuery, TierReadResult } from '../cognitive/tier-types.js';
import type { MemoryDatabase } from '../database/connection.js';
import { kvStore } from '../database/schema.js';

export interface TierFsAdapterOptions {
  config: TierConfig;
  db: MemoryDatabase;
  namespace?: string | undefined;
  now?: (() => number) | undefined;
  tierName: TierName;
}

function sortByPromotionPriority(now: () => number, item: MemoryItem): number {
  const age = now() - item.createdAt;
  const recencyWeight = 1 / (1 + age / 1000);
  return item.importance * recencyWeight * (1 + item.accessCount * 0.1);
}

function makeKey(namespace: string, tierName: TierName, itemId: string): string {
  return `tier:${namespace}:${tierName}:${itemId}`;
}

function parseItem(value: string): MemoryItem {
  const parsed = JSON.parse(value) as Record<string, unknown>;
  return {
    id: String(parsed.id),
    kind: String(parsed.kind) as MemoryItem['kind'],
    content: String(parsed.content),
    tokenCount: Number(parsed.tokenCount),
    importance: Number(parsed.importance),
    writeHeap: String(parsed.writeHeap) as MemoryItem['writeHeap'],
    reuseClass: String(parsed.reuseClass) as MemoryItem['reuseClass'],
    createdAt: Number(parsed.createdAt),
    lastAccessedAt: Number(parsed.lastAccessedAt),
    accessCount: Number(parsed.accessCount),
    fingerprint: String(parsed.fingerprint),
    metadata: (parsed.metadata ?? {}) as Record<string, unknown>
  };
}

function serializeItem(item: MemoryItem): string {
  return JSON.stringify(item);
}

/**
 * Create a MemoryTierLike adapter backed by the AgentFS `kv_store` table.
 * Stores memory items as JSON values keyed by tier namespace and item ID.
 */
export function createTierFsAdapter(options: TierFsAdapterOptions): MemoryTierLike {
  const { db, tierName, config, namespace = 'default' } = options;
  const now = options.now ?? (() => performance.now());
  const prefix = `tier:${namespace}:${tierName}:`;

  function keyFor(itemId: string): string {
    return makeKey(namespace, tierName, itemId);
  }

  function isExpired(item: MemoryItem): boolean {
    if (config.ttlMs === Number.POSITIVE_INFINITY) {
      return false;
    }
    return now() - item.createdAt > config.ttlMs;
  }

  function getCapacityStats(): { usedItems: number; usedTokens: number } {
    const rows = db
      .select({ value: kvStore.value })
      .from(kvStore)
      .where(like(kvStore.key, `${prefix}%`))
      .all();

    let usedItems = 0;
    let usedTokens = 0;
    for (const row of rows) {
      try {
        const item = parseItem(row.value);
        if (!isExpired(item)) {
          usedItems++;
          usedTokens += item.tokenCount;
        }
      } catch {
        // skip malformed
      }
    }

    return { usedItems, usedTokens };
  }

  function readItems(): MemoryItem[] {
    const rows = db
      .select({ value: kvStore.value })
      .from(kvStore)
      .where(like(kvStore.key, `${prefix}%`))
      .all();

    const items: MemoryItem[] = [];
    for (const row of rows) {
      try {
        const item = parseItem(row.value);
        if (!isExpired(item)) {
          items.push(item);
        }
      } catch {
        // Gracefully skip malformed entries
      }
    }
    return items;
  }

  function readItemsFiltered(query: TierReadQuery): MemoryItem[] {
    let items = readItems();

    if (query.minImportance !== undefined) {
      const threshold = query.minImportance;
      items = items.filter(i => i.importance >= threshold);
    }
    if (query.kind !== undefined) {
      items = items.filter(i => i.kind === query.kind);
    }
    if (query.writeHeap !== undefined) {
      items = items.filter(i => i.writeHeap === query.writeHeap);
    }

    items.sort((a, b) => b.importance - a.importance);
    return items;
  }

  return {
    get config() {
      return config;
    },

    get level() {
      return config.level;
    },

    get name() {
      return tierName;
    },

    write(item: MemoryItem): MemoryItem | null {
      const existing = db
        .select({ key: kvStore.key })
        .from(kvStore)
        .where(eq(kvStore.key, keyFor(item.id)))
        .get();

      if (existing) {
        return null;
      }

      const { usedItems, usedTokens } = getCapacityStats();
      if (config.maxItems !== Number.POSITIVE_INFINITY && usedItems >= config.maxItems) {
        return null;
      }
      if (config.maxTokens !== Number.POSITIVE_INFINITY && usedTokens + item.tokenCount > config.maxTokens) {
        return null;
      }

      db.insert(kvStore)
        .values({
          key: keyFor(item.id),
          value: serializeItem(item),
          updatedAt: Math.floor(now() / 1000)
        })
        .run();

      return item;
    },

    read(query: TierReadQuery = {}): TierReadResult {
      const items = readItemsFiltered(query);
      const limitIsDefined = query.limit !== undefined;
      const overflowed = limitIsDefined && items.length > (query.limit ?? 0);
      const limited = limitIsDefined ? items.slice(0, query.limit ?? 0) : items;
      const tokenCount = limited.reduce((sum, i) => sum + i.tokenCount, 0);

      return { items: limited, overflowed, tierName, tokenCount };
    },

    capacity() {
      const { usedItems, usedTokens } = getCapacityStats();
      return {
        maxItems: config.maxItems,
        maxTokens: config.maxTokens,
        usedItems,
        usedTokens
      };
    },

    evict(count: number): MemoryItem[] {
      const items = readItems().sort((a, b) => a.importance - b.importance);
      const toEvict = items.slice(0, count);

      for (const item of toEvict) {
        db.delete(kvStore)
          .where(eq(kvStore.key, keyFor(item.id)))
          .run();
      }

      return toEvict;
    },

    promote(count: number, to: MemoryTierLike): number {
      const items = readItems().sort((a, b) => sortByPromotionPriority(now, b) - sortByPromotionPriority(now, a));

      let promoted = 0;
      for (const item of items) {
        if (promoted >= count) {
          break;
        }

        const written = to.write({
          ...item,
          lastAccessedAt: now(),
          accessCount: item.accessCount + 1
        });

        if (written !== null) {
          db.delete(kvStore)
            .where(eq(kvStore.key, keyFor(item.id)))
            .run();
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
      const rows = db
        .select({ key: kvStore.key })
        .from(kvStore)
        .where(like(kvStore.key, `${prefix}%`))
        .all();

      for (const row of rows) {
        db.delete(kvStore).where(eq(kvStore.key, row.key)).run();
      }
    },

    items(): readonly MemoryItem[] {
      return readItems();
    }
  };
}
