import { describe, expect, it } from "vitest";

import { createAgentFsManager } from "./manager.js";
import { createSnapshotStore } from "./snapshots.js";

describe(createSnapshotStore, () => {
  it("captures a snapshot of current manager state", () => {
    const mgr = createAgentFsManager();
    mgr.write("/a.txt", "hello");
    mgr.write("/b.txt", "world");
    const store = createSnapshotStore();
    const snap = store.capture(mgr);
    expect(snap.id).toMatch(/^snap-/);
    expect(snap.entries).toHaveLength(2);
    expect(snap.timestamp).toBeLessThanOrEqual(Date.now());
  });

  it("stores optional label on snapshot", () => {
    const mgr = createAgentFsManager();
    const store = createSnapshotStore();
    const snap = store.capture(mgr, "my-label");
    expect(snap.label).toBe("my-label");
  });

  it("snapshot without label has no label field", () => {
    const mgr = createAgentFsManager();
    const store = createSnapshotStore();
    const snap = store.capture(mgr);
    expect(snap.label).toBeUndefined();
  });

  it("restores manager state from snapshot", () => {
    const mgr = createAgentFsManager();
    mgr.write("/x.txt", "original");
    const store = createSnapshotStore();
    const snap = store.capture(mgr);

    mgr.write("/y.txt", "added-after");
    mgr.delete("/x.txt");

    expect(mgr.has("/x.txt")).toBeFalsy();
    expect(mgr.has("/y.txt")).toBeTruthy();

    const restored = store.restore(snap.id, mgr);
    expect(restored).toBeTruthy();
    expect(mgr.has("/x.txt")).toBeTruthy();
    expect(mgr.read("/x.txt")?.content).toBe("original");
    expect(mgr.has("/y.txt")).toBeFalsy();
  });

  it("restore returns false for missing snapshot", () => {
    const mgr = createAgentFsManager();
    const store = createSnapshotStore();
    expect(store.restore("snap-nonexistent", mgr)).toBeFalsy();
  });

  it("list() returns snapshots newest-first", async () => {
    const mgr = createAgentFsManager();
    const store = createSnapshotStore();
    const snap1 = store.capture(mgr, "first");
    await new Promise((r) => setTimeout(r, 5));
    const snap2 = store.capture(mgr, "second");
    const list = store.list();
    expect(list[0]?.id).toBe(snap2.id);
    expect(list[1]?.id).toBe(snap1.id);
  });

  it("get() returns snapshot by id", () => {
    const mgr = createAgentFsManager();
    const store = createSnapshotStore();
    const snap = store.capture(mgr, "test");
    expect(store.get(snap.id)).toStrictEqual(snap);
  });

  it("get() returns undefined for missing id", () => {
    const store = createSnapshotStore();
    expect(store.get("snap-missing")).toBeUndefined();
  });

  it("delete() removes a snapshot", () => {
    const mgr = createAgentFsManager();
    const store = createSnapshotStore();
    const snap = store.capture(mgr);
    expect(store.delete(snap.id)).toBeTruthy();
    expect(store.get(snap.id)).toBeUndefined();
  });

  it("delete() returns false for missing snapshot", () => {
    const store = createSnapshotStore();
    expect(store.delete("snap-ghost")).toBeFalsy();
  });
});
