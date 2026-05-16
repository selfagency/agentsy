import { describe, expect, it } from "vitest";

import {
  buildRuntimeMemoryContextXml,
  injectRuntimeMemoryContext,
} from "./memory-injection.js";

describe("runtime memory injection", () => {
  it("builds memory context XML including citation metadata", () => {
    const xml = buildRuntimeMemoryContextXml([
      {
        citations: [
          {
            sourceId: "wiki:oauth",
            sourceType: "wiki",
            title: "OAuth Wiki",
          },
        ],
        content: "Rotate refresh tokens periodically",
        id: "e1",
        scope: "project",
        score: 0.91,
        title: "OAuth policy",
      },
    ]);

    expect(xml).toContain("<memory_context>");
    expect(xml).toContain("<citations>");
    expect(xml).toContain('source_id="wiki:oauth"');
  });

  it("injects context ahead of prompt and replaces existing memory_context block", () => {
    const existing =
      '<memory_context><memory_item id="old" /></memory_context>\nPrompt body';
    const next = '<memory_context><memory_item id="new" /></memory_context>';

    const output = injectRuntimeMemoryContext(existing, next);

    expect(output).toContain('id="new"');
    expect(output).not.toContain('id="old"');
    expect(output).toContain("Prompt body");
  });
});
