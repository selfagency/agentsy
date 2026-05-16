import { describe, expect, it } from "vitest";

import { createContextFingerprint, createMemoryReuseHint } from "./index.js";

describe("cache-aware memory metadata", () => {
  it("creates reusable context fingerprint and reuse hint objects", () => {
    const fingerprint = createContextFingerprint({
      content: "system prompt",
      modelFamily: "qwen",
      schemaVersion: 1,
      templateVersion: "v3",
    });

    const hint = createMemoryReuseHint({
      invalidationKeys: ["model-family:qwen", "template:v3"],
      reuseClass: "hot",
      stablePrefix: true,
      toolSchema: true,
    });

    expect(fingerprint.value).toMatch(/^sha256:/);
    expect(fingerprint.modelFamily).toBe("qwen");
    expect(hint.reuseClass).toBe("hot");
    expect(hint.invalidationKeys).toContain("template:v3");
  });
});
