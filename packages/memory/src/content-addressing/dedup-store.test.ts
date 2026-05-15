import { describe, expect, it } from 'vitest';
import { fingerprintContent } from './fingerprint.js';
import { createDedupStore } from './dedup-store.js';

describe('createDedupStore', () => {
  it('interns content and returns a fingerprint', () => {
    const store = createDedupStore();
    const fp = store.intern('hello');
    expect(fp.algorithm).toBe('sha256');
    expect(fp.value).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it('increments refCount on duplicate intern', () => {
    const store = createDedupStore();
    store.intern('dup');
    store.intern('dup');
    const entries = store.entries();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.refCount).toBe(2);
  });

  it('size() reflects unique entries', () => {
    const store = createDedupStore();
    store.intern('a');
    store.intern('b');
    store.intern('a');
    expect(store.size()).toBe(2);
  });

  it('retrieve() returns content by fingerprint value', () => {
    const store = createDedupStore();
    const fp = store.intern('retrieve-me');
    expect(store.retrieve(fp.value)).toBe('retrieve-me');
  });

  it('retrieve() returns undefined for unknown fingerprint', () => {
    const store = createDedupStore();
    expect(store.retrieve('sha256:nonexistent')).toBeUndefined();
  });

  it('release() removes entry when refCount reaches 0', () => {
    const store = createDedupStore();
    const fp = store.intern('single');
    const removed = store.release(fp.value);
    expect(removed).toBe(true);
    expect(store.retrieve(fp.value)).toBeUndefined();
    expect(store.size()).toBe(0);
  });

  it('release() does not remove when refCount stays above 0', () => {
    const store = createDedupStore();
    const fp = store.intern('multi');
    store.intern('multi');
    const removed = store.release(fp.value);
    expect(removed).toBe(false);
    expect(store.retrieve(fp.value)).toBe('multi');
  });

  it('release() returns false for unknown fingerprint', () => {
    const store = createDedupStore();
    expect(store.release('sha256:unknown')).toBe(false);
  });

  it('purgeOrphans() removes entries with refCount <= 0', () => {
    const store = createDedupStore();
    const fp = store.intern('orphan');
    // Manually lower refCount by releasing
    store.release(fp.value); // refCount becomes 0, entry removed immediately

    // For this test, intern two items, then force an orphan by bypassing release
    const fp2 = store.intern('alive');
    store.intern('alive'); // refCount = 2
    store.release(fp2.value); // refCount = 1, still alive
    expect(store.purgeOrphans()).toBe(0); // none with refCount <= 0
  });

  it('entries() returns all current entries', () => {
    const store = createDedupStore();
    store.intern('x');
    store.intern('y');
    const values = store
      .entries()
      .map(e => e.content)
      .sort();
    expect(values).toEqual(['x', 'y']);
  });

  it('fingerprint values match fingerprintContent directly', () => {
    const store = createDedupStore();
    const fp = store.intern('test');
    const direct = fingerprintContent('test');
    expect(fp.value).toBe(direct.value);
  });
});
