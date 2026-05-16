import { describe, expect, it } from "vitest";

import { createMemoryCaptureTool } from "./memory-capture.js";

describe("memory_capture tool", () => {
  it("captures scoped memory records", async () => {
    const rows: { id: string; content: string; scope: string }[] = [];
    const tool = createMemoryCaptureTool({
      save: (record) => {
        rows.push(record);
      },
    });

    const result = await tool.execute({
      actorId: "u1",
      content: "remember this",
      scope: "session",
    });
    expect(result.record.scope).toBe("session");
    expect(rows).toHaveLength(1);
  });
});
