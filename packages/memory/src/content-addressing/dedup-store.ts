import type { ContentFingerprint } from './fingerprint.js';
import { fingerprintContent } from './fingerprint.js';

export interface DedupEntry {
  readonly fingerprint: ContentFingerprint;
  readonly content: string;
  refCount: number;
}

export interface DedupStore {
  /** Intern content, increment ref count, and return its fingerprint. */
  intern(content: string): ContentFingerprint;
  /** Retrieve content by fingerprint value string. */
  retrieve(fingerprintValue: string): string | undefined;
  /** Decrement ref count; remove if zero. Returns true if removed. */
  release(fingerprintValue: string): boolean;
  size(): number;
  entries(): DedupEntry[];
  /** Remove entries with refCount <= 0 and return the count purged. */
  purgeOrphans(): number;
}

export function createDedupStore(): DedupStore {
  const store = new Map<string, DedupEntry>();

  return {
    intern(content) {
      const fp = fingerprintContent(content);
      const existing = store.get(fp.value);
      if (existing !== undefined) {
        existing.refCount++;
        return fp;
      }
      store.set(fp.value, { fingerprint: fp, content, refCount: 1 });
      return fp;
    },

    retrieve(fingerprintValue) {
      return store.get(fingerprintValue)?.content;
    },

    release(fingerprintValue) {
      const entry = store.get(fingerprintValue);
      if (entry === undefined) return false;
      entry.refCount--;
      if (entry.refCount <= 0) {
        store.delete(fingerprintValue);
        return true;
      }
      return false;
    },

    size() {
      return store.size;
    },

    entries() {
      return [...store.values()];
    },

    purgeOrphans() {
      let count = 0;
      for (const [key, entry] of store) {
        if (entry.refCount <= 0) {
          store.delete(key);
          count++;
        }
      }
      return count;
    }
  };
}
