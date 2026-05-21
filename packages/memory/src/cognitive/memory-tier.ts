import { and, asc, desc, eq, gte, sql } from 'drizzle-orm';

import type { MemoryDatabase } from '../database/connection.js';
import { memoryItems } from '../database/schema.js';
import type { MemoryItem, TierConfig, TierLevel, TierName, TierReadQuery, TierReadResult } from './tier-types.js';
import { TIER_LEVELS, TIER_NAMES } from './tier-types.js';

export interface MemoryTierLike {
  readonly name: TierName;
  readonly level: TierLevel;
  readonly config: TierConfig;
  write(item: MemoryItem): MemoryItem | null;
  read(query?: TierReadQuery): TierReadResult;
  capacity(): {
    usedTokens: number;
    maxTokens: number;
    usedItems: number;
    maxItems: number;
  };
  evict(count: number): MemoryItem[];
  promote(count: number, to: MemoryTierLike): number;
  demote(count: number, from: MemoryTierLike): number;
  clear(): void;
  items(): readonly MemoryItem[];
}

export interface MemoryTierOptions {
  config: TierConfig;
  now?: (() => number) | undefined;
  db?: MemoryDatabase | undefined;
}

function sortByPromotionPriority(now: () => number, item: MemoryItem): number {
  const age = now() - item.createdAt;
  const recencyWeight = 1 / (1 + age / 1000);
  return item.importance * recencyWeight * (1 + item.accessCount * 0.1);
}

// ---------------------------------------------------------------------------
// In-memory tier (original behavior, used when db is absent)
// ---------------------------------------------------------------------------

function createInMemoryMemoryTier(config: TierConfig, nowFn?: () => number): MemoryTierLike {
  const now = nowFn ?? (() => performance.now());
  const items = new Map<string, MemoryItem>();

  let usedTokens = 0;

  function isExpired(item: MemoryItem): boolean {
    if (config.ttlMs === Infinity) return false;
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

      if (items.has(item.id)) return null;
      if (config.maxItems !== Infinity && items.size >= config.maxItems) return null;
      if (config.maxTokens !== Infinity && usedTokens + item.tokenCount > config.maxTokens) return null;

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

      const sorted = [...items.values()].sort(
        (a, b) => sortByPromotionPriority(now, b) - sortByPromotionPriority(now, a)
      );

      let promoted = 0;
      for (const item of sorted) {
        if (promoted >= count) break;

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
        if (demoted >= count) break;

        const written = this.write({
          ...item,
          lastAccessedAt: now(),
          accessCount: item.accessCount + 1
        });

        if (written !== null) demoted++;
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

// ---------------------------------------------------------------------------
// SQLite-backed tier
// ---------------------------------------------------------------------------

function memoryItemToRow(item: MemoryItem, tierName: TierName) {
  return {
    id: item.id,
    tier: tierName,
    kind: item.kind,
    content: item.content,
    tokenCount: item.tokenCount,
    importance: item.importance,
    writeHeap: item.writeHeap,
    reuseClass: item.reuseClass,
    createdAt: item.createdAt,
    lastAccessedAt: item.lastAccessedAt,
    accessCount: item.accessCount,
    fingerprint: item.fingerprint,
    metadata: JSON.stringify(item.metadata)
  };
}

function rowToMemoryItem(row: { [key: string]: unknown }): MemoryItem {
  return {
    id: String(row.id),
    kind: String(row.kind) as MemoryItem['kind'],
    content: String(row.content),
    tokenCount: Number(row.tokenCount),
    importance: Number(row.importance),
    writeHeap: String(row.writeHeap) as MemoryItem['writeHeap'],
    reuseClass: String(row.reuseClass) as MemoryItem['reuseClass'],
    createdAt: Number(row.createdAt),
    lastAccessedAt: Number(row.lastAccessedAt),
    accessCount: Number(row.accessCount),
    fingerprint: String(row.fingerprint),
    metadata: JSON.parse(String(row.metadata)) as Record<string, unknown>
  };
}

function createSQLiteMemoryTier(db: MemoryDatabase, config: TierConfig, nowFn?: () => number): MemoryTierLike {
  const now = nowFn ?? (() => performance.now());

  function getCapacityStats() {
    const result = db
      .select({
        count: sql`count(*)`,
        totalTokens: sql`COALESCE(SUM(token_count), 0)`
      })
      .from(memoryItems)
      .where(eq(memoryItems.tier, config.name))
      .get();

    return {
      usedItems: Number(result?.count ?? 0),
      usedTokens: Number(result?.totalTokens ?? 0)
    };
  }

  function evictExpired(): void {
    if (config.ttlMs === Infinity) return;
    const cutoff = now() - config.ttlMs;
    db.delete(memoryItems)
      .where(and(eq(memoryItems.tier, config.name), sql`${memoryItems.createdAt} < ${cutoff}`))
      .run();
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

      const existing = db
        .select()
        .from(memoryItems)
        .where(and(eq(memoryItems.id, item.id), eq(memoryItems.tier, config.name)))
        .get();
      if (existing) return null;

      const { usedItems, usedTokens } = getCapacityStats();
      if (config.maxItems !== Infinity && usedItems >= config.maxItems) return null;
      if (config.maxTokens !== Infinity && usedTokens + item.tokenCount > config.maxTokens) return null;

      db.insert(memoryItems).values(memoryItemToRow(item, config.name)).run();
      return item;
    },

    read(query: TierReadQuery = {}): TierReadResult {
      evictExpired();

      const conditions = [eq(memoryItems.tier, config.name)];
      if (query.minImportance !== undefined) {
        conditions.push(gte(memoryItems.importance, query.minImportance));
      }
      if (query.kind !== undefined) {
        conditions.push(eq(memoryItems.kind, query.kind));
      }
      if (query.writeHeap !== undefined) {
        conditions.push(eq(memoryItems.writeHeap, query.writeHeap));
      }

      let rows = db
        .select()
        .from(memoryItems)
        .where(and(...conditions))
        .orderBy(desc(memoryItems.importance))
        .all();

      const overflowed = query.limit !== undefined && rows.length > query.limit;
      if (query.limit !== undefined) {
        rows = rows.slice(0, query.limit);
      }

      const items = rows.map(rowToMemoryItem);
      const tokenCount = items.reduce((sum, i) => sum + i.tokenCount, 0);

      return { items, overflowed, tierName: config.name, tokenCount };
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
      evictExpired();

      const rows = db
        .select()
        .from(memoryItems)
        .where(eq(memoryItems.tier, config.name))
        .orderBy(asc(memoryItems.importance))
        .limit(count)
        .all();

      for (const row of rows) {
        db.delete(memoryItems)
          .where(and(eq(memoryItems.id, String(row.id)), eq(memoryItems.tier, config.name)))
          .run();
      }

      return rows.map(rowToMemoryItem);
    },

    promote(count: number, to: MemoryTierLike): number {
      evictExpired();

      const rows = db.select().from(memoryItems).where(eq(memoryItems.tier, config.name)).all();

      const sorted = rows
        .map(rowToMemoryItem)
        .sort((a, b) => sortByPromotionPriority(now, b) - sortByPromotionPriority(now, a));

      let promoted = 0;
      for (const item of sorted) {
        if (promoted >= count) break;

        const written = to.write({
          ...item,
          lastAccessedAt: now(),
          accessCount: item.accessCount + 1
        });

        if (written !== null) {
          db.delete(memoryItems)
            .where(and(eq(memoryItems.id, item.id), eq(memoryItems.tier, config.name)))
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
        if (demoted >= count) break;

        const written = this.write({
          ...item,
          lastAccessedAt: now(),
          accessCount: item.accessCount + 1
        });

        if (written !== null) demoted++;
      }

      return demoted;
    },

    clear(): void {
      db.delete(memoryItems).where(eq(memoryItems.tier, config.name)).run();
    },

    items(): readonly MemoryItem[] {
      const rows = db.select().from(memoryItems).where(eq(memoryItems.tier, config.name)).all();
      return rows.map(rowToMemoryItem);
    }
  };
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createMemoryTier(options: MemoryTierOptions): MemoryTierLike {
  if (options.db) {
    return createSQLiteMemoryTier(options.db, options.config, options.now);
  }
  return createInMemoryMemoryTier(options.config, options.now);
}

export function nextTierName(current: TierName): TierName | null {
  // nosemgrep: current key comes from TierName enum, verified to exist in TIER_LEVELS
  const level = TIER_LEVELS[current];
  if (level >= 5) return null;
  // nosemgrep: level+1 is a numeric array index bounded by known tier levels
  // NOSONAR: cast is required by strict TS for Record<TierLevel, TierName> index
  const nextTierName = TIER_NAMES[(level + 1) as TierLevel];
  return nextTierName ?? null;
}

export function prevTierName(current: TierName): TierName | null {
  // nosemgrep: current key comes from TierName enum, verified to exist in TIER_LEVELS
  const level = TIER_LEVELS[current];
  if (level <= 1) return null;
  // nosemgrep: level-1 is a numeric array index bounded by known tier levels
  // NOSONAR: cast is required by strict TS for Record<TierLevel, TierName> index
  const prevTierName = TIER_NAMES[(level - 1) as TierLevel];
  return prevTierName ?? null;
}
