import type { DedupStore } from './dedup-store.js';
import { fingerprintContent } from './fingerprint.js';

export interface MigrateStats {
  readonly total: number;
  readonly deduped: number;
  readonly unique: number;
}

/**
 * Migrates a collection of raw content strings into a dedup store.
 * Returns stats indicating how many were duplicate.
 */
export function migrateContentToDedupStore(contents: readonly string[], store: DedupStore): MigrateStats {
  const seen = new Map<string, number>();
  let deduped = 0;

  for (const content of contents) {
    const fp = fingerprintContent(content);
    const count = seen.get(fp.value) ?? 0;
    seen.set(fp.value, count + 1);
    store.intern(content);
    if (count > 0) {
      deduped++;
    }
  }

  return {
    deduped,
    total: contents.length,
    unique: store.size()
  };
}
