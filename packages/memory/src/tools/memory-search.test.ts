import { describe, expect, it } from "vitest";

import { createMemorySearchTool } from "./memory-search.js";

describe("memory_search tool", () => {
  it("delegates to retriever and returns ranked results", async () => {
    const tool = createMemorySearchTool({
      search: async () => [
        {
          reasons: ["lexical:1.00"],
          record: {
            content: "oauth",
            createdAt: new Date("2026-01-01T00:00:00Z"),
            id: "auth",
            scope: "project",
          },
          score: 0.9,
        },
      ],
    });

    const result = await tool.execute({
      limit: 3,
      query: "oauth",
      scope: "project",
    });
    expect(result.results[0]?.record.id).toBe("auth");
  });
});
