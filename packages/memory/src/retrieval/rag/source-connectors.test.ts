import { describe, expect, it } from "vitest";

import { createSourceConnectors } from "./source-connectors.js";

describe("source connectors", () => {
  it("blocks web fetch for hosts outside allowlist", async () => {
    const connectors = createSourceConnectors({
      web: {
        allowHosts: ["docs.example.com"],
        enabled: true,
      },
    });

    await expect(
      connectors.fetchWebSource("https://evil.example.net/attack")
    ).rejects.toThrow("allowlist");
  });
});
