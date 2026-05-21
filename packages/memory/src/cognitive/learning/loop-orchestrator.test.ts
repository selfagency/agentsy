import { describe, expect, it } from "vitest";

import type { MemoryItem } from "../tier-types.js";
import { createLearningLoopOrchestrator } from "./loop-orchestrator.js";

function makeMemory(id: string, content: string): MemoryItem {
  const now = 1_000_000;
  return {
    id,
    kind: "semantic",
    content,
    tokenCount: 10,
    importance: 0.7,
    writeHeap: "event",
    reuseClass: "hot",
    createdAt: now - 1_000,
    lastAccessedAt: now - 100,
    accessCount: 3,
    fingerprint: `fp-${id}`,
    metadata: {},
  };
}

describe("LearningLoopOrchestrator", () => {
  const orchestrator = createLearningLoopOrchestrator();

  it("runs a full learning cycle", async () => {
    const result = await orchestrator.runCycle({
      getNewMemories: () => [
        makeMemory("1", "The user is a developer who likes TypeScript."),
        makeMemory("2", "The project uses ESM modules."),
      ],
      getLTMMemories: () => [],
    });

    expect(result.observationsExtracted).toBeGreaterThanOrEqual(0);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.consolidationsProduced).toBeGreaterThanOrEqual(0);
  });

  it("returns zero counts with empty input", async () => {
    const result = await orchestrator.runCycle({
      getNewMemories: () => [],
      getLTMMemories: () => [],
    });

    expect(result.observationsExtracted).toBe(0);
    expect(result.contradictionsFound).toBe(0);
    expect(result.resolutionsProduced).toBe(0);
  });

  it("emits events when emitEvent is provided", async () => {
    const events: { type: string; payload: Record<string, unknown> }[] = [];
    const result = await orchestrator.runCycle({
      getNewMemories: () => [makeMemory("1", "Test content.")],
      getLTMMemories: () => [],
      emitEvent: (e) => events.push(e),
    });

    expect(events.length).toBeGreaterThanOrEqual(3); // observations, dialectic, consolidation, solidify, canary
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("respects batch size config", async () => {
    const result = await orchestrator.runCycle(
      {
        getNewMemories: (limit) =>
          [
            makeMemory("1", "A"),
            makeMemory("2", "B"),
            makeMemory("3", "C"),
          ].slice(0, limit),
        getLTMMemories: () => [],
      },
      { observation: { batchSize: 2, extractors: ["factual"] } },
    );

    expect(result.observationsExtracted).toBeLessThanOrEqual(2);
  });
});
