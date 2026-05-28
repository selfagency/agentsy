export interface KvEntry<T = string> {
  readonly expiresAt?: number;
  readonly key: string;
  readonly setAt: number;
  readonly value: T;
}

export interface KvStore<T = string> {
  clear(): void;
  delete(key: string): boolean;
  entries(): KvEntry<T>[];
  get(key: string): T | undefined;
  has(key: string): boolean;
  keys(): string[];
  /** Purge all expired entries and return the count removed. */
  purgeExpired(): number;
  set(key: string, value: T, ttlMs?: number): void;
}

export function createKvStore<T = string>(): KvStore<T> {
  const store = new Map<string, KvEntry<T>>();

  function isExpired(entry: KvEntry<T>): boolean {
    return entry.expiresAt !== undefined && Date.now() > entry.expiresAt;
  }

  return {
    clear() {
      store.clear();
    },

    delete(key) {
      return store.delete(key);
    },

    entries() {
      return [...store.values()].filter(e => !isExpired(e));
    },

    get(key) {
      const entry = store.get(key);
      if (entry === undefined) {
        return;
      }
      if (isExpired(entry)) {
        store.delete(key);
        return;
      }
      return entry.value;
    },

    has(key) {
      const entry = store.get(key);
      if (entry === undefined) {
        return false;
      }
      if (isExpired(entry)) {
        store.delete(key);
        return false;
      }
      return true;
    },

    keys() {
      return [...store.keys()].filter(k => {
        const entry = store.get(k);
        return entry !== undefined && !isExpired(entry);
      });
    },

    purgeExpired() {
      let count = 0;
      for (const [key, entry] of store) {
        if (isExpired(entry)) {
          store.delete(key);
          count++;
        }
      }
      return count;
    },

    set(key, value, ttlMs) {
      const entry: KvEntry<T> = {
        key,
        setAt: Date.now(),
        value,
        ...(ttlMs ? { expiresAt: Date.now() + ttlMs } : {})
      };
      store.set(key, entry);
    }
  };
}
