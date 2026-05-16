import { describe, expect, it } from "vitest";

import { createMemoryLintTool } from "./memory-lint.js";

describe("memory_lint tool", () => {
  it("flags secret-like patterns and oversized records", async () => {
    const tool = createMemoryLintTool({
      list: () => [
        {
          actorId: "u1",
          content: "normal",
          createdAt: new Date("2026-01-01T00:00:00Z"),
          id: "1",
          scope: "session",
        },
        {
          actorId: "u1",
          content: "api_key=sk_live_123456789",
          createdAt: new Date("2026-01-01T00:00:00Z"),
          id: "2",
          scope: "project",
        },
        {
          actorId: "u1",
          content: "x".repeat(1500),
          createdAt: new Date("2026-01-01T00:00:00Z"),
          id: "3",
          scope: "project",
        },
      ],
    });

    const result = await tool.execute({ maxContentLength: 1024 });
    expect(
      result.issues.some((issue) => issue.code === "secret-like-pattern")
    ).toBeTruthy();
    expect(
      result.issues.some((issue) => issue.code === "oversized-record")
    ).toBeTruthy();
  });
});
