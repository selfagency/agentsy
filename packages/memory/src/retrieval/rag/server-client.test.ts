import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createRAGServerClient } from "./server-client.js";
import { createMockRAGState, createRAGMockServer } from "./test-msw.js";

const BASE_URL = "http://rag.local";
const state = createMockRAGState();
const server = createRAGMockServer(BASE_URL, state);

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  server.resetHandlers();
  state.healthy = true;
  state.documents.clear();
  state.searchResults = [];
});

afterAll(() => {
  server.close();
});

describe("RAGServerClient", () => {
  it("checks health, upserts documents, searches, and deletes documents", async () => {
    const client = createRAGServerClient({ baseUrl: BASE_URL, timeoutMs: 500 });

    const health = await client.health();
    expect(health.ok).toBeTruthy();

    await client.upsert({
      chunkIndex: 0,
      content: "Access tokens typically expire quickly.",
      id: "doc-1",
      metadata: { tags: ["oauth"] },
      sourceId: "wiki:oauth",
      sourceType: "wiki",
      title: "OAuth token lifetime",
      updatedAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
    });

    state.searchResults = [
      {
        content: "Access tokens typically expire quickly.",
        id: "doc-1",
        metadata: { tags: ["oauth"] },
        score: 0.91,
        sourceId: "wiki:oauth",
        sourceType: "wiki",
        title: "OAuth token lifetime",
        updatedAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
      },
    ];

    const results = await client.search({ limit: 5, query: "oauth token" });
    expect(results[0]?.id).toBe("doc-1");

    const deletion = await client.delete("doc-1");
    expect(deletion.deleted).toBeTruthy();
  });

  it("returns degraded health when remote endpoint fails", async () => {
    state.healthy = false;
    const client = createRAGServerClient({ baseUrl: BASE_URL, timeoutMs: 500 });

    const health = await client.health();
    expect(health.ok).toBeFalsy();
  });
});
