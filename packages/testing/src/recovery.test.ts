import { LLMStreamProcessor } from "@agentsy/core/processor";
import type { StreamSnapshot } from "@agentsy/core/recovery";
import {
  buildContinuationPrompt,
  captureStreamState,
} from "@agentsy/core/recovery";
/**
 * Integration: recovery — captureStreamState + buildContinuationPrompt
 *
 * Verifies stream snapshot creation and provider-specific continuation prompts.
 */
import { describe, expect, it } from "vitest";

function makeSnapshot(content: string): StreamSnapshot {
  const processor = new LLMStreamProcessor({ scrubContextTags: false });
  if (content) {
    processor.process({ content });
  }
  return captureStreamState(processor);
}

// ---------------------------------------------------------------------------
// captureStreamState
// ---------------------------------------------------------------------------

describe(captureStreamState, () => {
  it("captures empty state on a fresh processor", () => {
    const processor = new LLMStreamProcessor({ scrubContextTags: false });
    const snapshot = captureStreamState(processor);

    expect(snapshot.content).toBe("");
    expect(snapshot.thinking).toBe("");
    expect(snapshot.toolCalls).toHaveLength(0);
    expect(snapshot.timestamp).toBeGreaterThan(0);
  });

  it("captures accumulated content after processing chunks", () => {
    const processor = new LLMStreamProcessor({ scrubContextTags: false });

    processor.process({ content: "Part one" });
    processor.process({ content: " part two" });

    const snapshot = captureStreamState(processor);

    expect(snapshot.content).toBe("Part one part two");
  });

  it("captures accumulated thinking after processing chunks", () => {
    const processor = new LLMStreamProcessor({ scrubContextTags: false });

    processor.process({ thinking: "inner reasoning" });
    processor.process({ content: "answer" });

    const snapshot = captureStreamState(processor);

    expect(snapshot.thinking).toBe("inner reasoning");
  });

  it("captures usage when the processor has received it", () => {
    const processor = new LLMStreamProcessor({ scrubContextTags: false });

    processor.process({
      content: "hi",
      done: true,
      usage: { inputTokens: 10, outputTokens: 5 },
    });
    processor.flush();

    const snapshot = captureStreamState(processor);

    expect(snapshot.usage?.inputTokens).toBe(10);
    expect(snapshot.usage?.outputTokens).toBe(5);
  });

  it("captures completed tool calls", () => {
    const processor = new LLMStreamProcessor({
      knownTools: new Set(["search"]),
      scrubContextTags: false,
    });

    processor.processComplete({
      content: "<search><query>test</query></search>",
      done: true,
    });

    const snapshot = captureStreamState(processor);

    expect(snapshot.toolCalls).toHaveLength(1);
    expect(snapshot.toolCalls[0]?.name).toBe("search");
  });

  it("includes a timestamp close to now", () => {
    const before = Date.now();
    const snapshot = captureStreamState(
      new LLMStreamProcessor({ scrubContextTags: false })
    );
    const after = Date.now();

    expect(snapshot.timestamp).toBeGreaterThanOrEqual(before);
    expect(snapshot.timestamp).toBeLessThanOrEqual(after);
  });
});

// ---------------------------------------------------------------------------
// buildContinuationPrompt
// ---------------------------------------------------------------------------

describe(buildContinuationPrompt, () => {
  it("returns a single user message when snapshot has no content", () => {
    const messages = buildContinuationPrompt(makeSnapshot(""));

    expect(messages).toHaveLength(1);
    expect(messages[0]?.role).toBe("user");
    expect(messages[0]?.content).toBe("Please continue.");
  });

  it("returns [assistant, user] for openai provider", () => {
    const messages = buildContinuationPrompt(
      makeSnapshot("Partial answer so far"),
      {
        provider: "openai",
      }
    );

    expect(messages).toHaveLength(2);
    expect(messages[0]?.role).toBe("assistant");
    expect(messages[0]?.content).toContain("Partial answer");
    expect(messages[1]?.role).toBe("user");
    expect(messages[1]?.content).toMatch(/continue/i);
  });

  it("defaults to openai format when provider is omitted", () => {
    const messages = buildContinuationPrompt(makeSnapshot("Answer start"));

    expect(messages[0]?.role).toBe("assistant");
    expect(messages[1]?.role).toBe("user");
  });

  it("returns [assistant] prefill for anthropic provider", () => {
    const messages = buildContinuationPrompt(
      makeSnapshot("Partial for anthropic"),
      {
        provider: "anthropic",
      }
    );

    expect(messages).toHaveLength(1);
    expect(messages[0]?.role).toBe("assistant");
    expect(messages[0]?.content).toContain("Partial for anthropic");
  });

  it("uses openai format for ollama provider", () => {
    const messages = buildContinuationPrompt(makeSnapshot("Ollama partial"), {
      provider: "ollama",
    });

    expect(messages).toHaveLength(2);
    expect(messages[0]?.role).toBe("assistant");
    expect(messages[1]?.role).toBe("user");
  });
});

// ---------------------------------------------------------------------------
// Full round-trip: process → capture → build continuation prompt
// ---------------------------------------------------------------------------

describe("captureStreamState + buildContinuationPrompt round-trip", () => {
  it("can build a continuation after a mid-stream snapshot", () => {
    const processor = new LLMStreamProcessor({ scrubContextTags: false });

    // Simulate partial stream — not done yet
    processor.process({ content: "The capital of France" });
    processor.process({ content: " is Paris," });

    const snapshot = captureStreamState(processor);
    const messages = buildContinuationPrompt(snapshot, { provider: "openai" });

    expect(snapshot.content).toBe("The capital of France is Paris,");
    expect(messages[0]?.content).toContain("Paris");
    expect(messages[1]?.content).toMatch(/continue/i);
  });

  it("preserves processor options in the snapshot", () => {
    const opts = {
      knownTools: new Set(["ping"]),
      parseThinkTags: true,
      scrubContextTags: false,
    };
    const processor = new LLMStreamProcessor(opts);
    const snapshot = captureStreamState(processor, opts);

    // Options are stored for possible processor reconstruction
    expect(snapshot.options).toMatchObject({ parseThinkTags: true });
  });
});
