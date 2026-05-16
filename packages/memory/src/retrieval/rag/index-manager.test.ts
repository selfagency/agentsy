import { describe, expect, it } from "vitest";

import { createIndexManager } from "./index-manager.js";

describe("IndexManager", () => {
  it("tracks inserted, updated, and skipped documents with fingerprints", () => {
    const manager = createIndexManager();
    const base = {
      chunkIndex: 0,
      content: "short-lived access tokens",
      id: "doc-1",
      sourceId: "wiki:oauth",
      sourceType: "wiki" as const,
      title: "OAuth",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    const first = manager.upsertMany([base]);
    const second = manager.upsertMany([base]);
    const third = manager.upsertMany([
      { ...base, content: "rotating refresh tokens" },
    ]);

    expect(first).toStrictEqual({ inserted: 1, skipped: 0, updated: 0 });
    expect(second).toStrictEqual({ inserted: 0, skipped: 1, updated: 0 });
    expect(third).toStrictEqual({ inserted: 0, skipped: 0, updated: 1 });
    expect(manager.get("doc-1")?.version).toBe(2);
  });
});
