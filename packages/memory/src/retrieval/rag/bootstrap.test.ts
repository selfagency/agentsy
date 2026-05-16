import { describe, expect, it } from "vitest";

import { createRAGBootstrapper } from "./bootstrap.js";

describe("RAG bootstrapper", () => {
  it("auto-ingests configured startup sources with deterministic document IDs", async () => {
    const calls: string[] = [];
    const bootstrapper = createRAGBootstrapper({
      collectSources: async () => [
        {
          content: "OAuth refresh flow and token lifetime docs.",
          sourceId: "docs:README",
          sourceType: "file",
        },
      ],
      ingest: async (input) => {
        calls.push(input.sourceId);
        return { inserted: 1, skipped: 0, updated: 0 };
      },
    });

    const result = await bootstrapper.initialize();

    expect(calls).toStrictEqual(["docs:README"]);
    expect(result.totalSources).toBe(1);
    expect(result.totalInserted).toBe(1);
  });
});
