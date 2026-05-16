import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createKvStore } from "./kv-store.js";

describe(createKvStore, () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should store and retrieve values", () => {
    const store = createKvStore<string>();
    store.set("foo", "bar");
    expect(store.get("foo")).toBe("bar");
    expect(store.has("foo")).toBeTruthy();
  });

  it("should return undefined for missing keys", () => {
    const store = createKvStore<string>();
    expect(store.get("missing")).toBeUndefined();
    expect(store.has("missing")).toBeFalsy();
  });

  it("should handle expiration with ttlMs", () => {
    const store = createKvStore<string>();

    store.set("ephemeral", "val", 100);
    expect(store.get("ephemeral")).toBe("val");

    // Advance time past expiry
    vi.advanceTimersByTime(101);

    expect(store.get("ephemeral")).toBeUndefined();
    expect(store.has("ephemeral")).toBeFalsy();
  });

  it("should delete keys", () => {
    const store = createKvStore<string>();
    store.set("foo", "bar");
    expect(store.delete("foo")).toBeTruthy();
    expect(store.has("foo")).toBeFalsy();
    expect(store.delete("nonexistent")).toBeFalsy();
  });

  it("should return non-expired keys", () => {
    const store = createKvStore<number>();
    store.set("a", 1);
    store.set("b", 2, 50);

    expect(store.keys()).toContain("a");
    expect(store.keys()).toContain("b");

    vi.advanceTimersByTime(51);
    expect(store.keys()).toStrictEqual(["a"]);
  });

  it("should return non-expired entries", () => {
    const store = createKvStore<number>();
    store.set("a", 1);
    store.set("b", 2, 50);

    expect(store.entries()).toHaveLength(2);

    vi.advanceTimersByTime(51);
    const entries = store.entries();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toBeDefined();
    expect(entries[0]?.key).toBe("a");
    expect(entries[0]?.value).toBe(1);
  });

  it("should clear the store", () => {
    const store = createKvStore();
    store.set("a", "1");
    store.clear();
    expect(store.keys()).toHaveLength(0);
  });

  it("should purge only expired entries", () => {
    const store = createKvStore<string>();
    store.set("keep1", "ok");
    store.set("expire1", "bye", 10);
    store.set("expire2", "bye", 20);

    vi.advanceTimersByTime(15);
    const count = store.purgeExpired();
    expect(count).toBe(1);
    expect(store.has("keep1")).toBeTruthy();
    expect(store.has("expire2")).toBeTruthy();

    vi.advanceTimersByTime(10);
    expect(store.purgeExpired()).toBe(1);
    expect(store.has("expire2")).toBeFalsy();
  });
});
