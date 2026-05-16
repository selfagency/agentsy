import { describe, expect, it } from "vitest";

import { buildContextSegments } from "./contextSegments.js";

describe(buildContextSegments, () => {
  it("builds deterministic reusable context segments", () => {
    const segments = buildContextSegments({
      memorySummary: "cached summary",
      modelFamily: "qwen",
      systemPrompt: "You are helpful",
      templateVersion: "v3",
      toolSchema: { properties: { name: { type: "string" } }, type: "object" },
    });

    expect(segments).toHaveLength(3);
    expect(segments[0]?.fingerprint.value).toMatch(/^sha256:/);
    expect(segments[0]?.reuseClass).toBe("hot");
    expect(
      segments.some((segment) => segment.invalidations.includes("template:v3"))
    ).toBeTruthy();
  });
});
