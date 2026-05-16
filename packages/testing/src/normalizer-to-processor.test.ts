import { LLMStreamProcessor } from "@agentsy/core/processor";
import type { NormalizerResult } from "@agentsy/providers/normalizers";
import {
  normalizeAnthropicEvent,
  normalizeBedrockConverseEvent,
  normalizeCohereEvent,
  normalizeGeminiChunk,
  normalizeOpenAIChatChunk,
  normalizeOpenAIResponseEvent,
} from "@agentsy/providers/normalizers";
/**
 * Integration: normalizer → LLMStreamProcessor
 *
 * Verifies that raw provider event shapes flow through each normalizer and
 * produce the expected processed output from the processor.  These tests
 * treat the two packages as a black-box pipeline — the individual unit tests
 * for each package live alongside their source files.
 */
import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Helper: pump a list of raw provider events through a normalizer and a fresh
// processor, returning the concatenated processed output.
// ---------------------------------------------------------------------------

function pump<T>(
  events: T[],
  normalizer: (e: T) => NormalizerResult | null,
  options: ConstructorParameters<typeof LLMStreamProcessor>[0] = {}
) {
  const processor = new LLMStreamProcessor(options);
  let content = "";
  let thinking = "";
  let done = false;

  for (const event of events) {
    const result = normalizer(event);
    if (!result) {
      continue;
    }
    const out = processor.process(result.chunk);
    content += out.content ?? "";
    thinking += out.thinking ?? "";
    if (out.done) {
      done = true;
    }
  }

  const flush = processor.flush();
  content += flush.content ?? "";
  thinking += flush.thinking ?? "";
  if (flush.done) {
    done = true;
  }

  return { content, done, processor, thinking };
}

// ---------------------------------------------------------------------------
// OpenAI Chat Completions
// ---------------------------------------------------------------------------

describe("normalizeOpenAIChatChunk → LLMStreamProcessor", () => {
  it("accumulates streamed content across multiple chunks", () => {
    const chunks = [
      { choices: [{ delta: { content: "Hello" }, finish_reason: null }] },
      { choices: [{ delta: { content: ", " }, finish_reason: null }] },
      { choices: [{ delta: { content: "world!" }, finish_reason: "stop" }] },
    ];

    const { content, done } = pump(chunks, normalizeOpenAIChatChunk);
    expect(content).toBe("Hello, world!");
    expect(done).toBeTruthy();
  });

  it("surfaces thinking / reasoning_content as thinking output", () => {
    const chunks = [
      {
        choices: [
          { delta: { reasoning_content: "step 1" }, finish_reason: null },
        ],
      },
      {
        choices: [
          {
            delta: { content: "answer", reasoning_content: " step 2" },
            finish_reason: "stop",
          },
        ],
      },
    ];

    const { content, thinking } = pump(chunks, normalizeOpenAIChatChunk);
    expect(thinking).toBe("step 1 step 2");
    expect(content).toBe("answer");
  });

  it("accumulates native tool_call deltas and maps them via processor", () => {
    // Native tool call: name arrives in first chunk, arguments stream in subsequent ones
    const chunks = [
      {
        choices: [
          {
            delta: {
              tool_calls: [
                {
                  function: { arguments: "", name: "get_weather" },
                  id: "call_1",
                  index: 0,
                  type: "function",
                },
              ],
            },
            finish_reason: null,
          },
        ],
      },
      {
        choices: [
          {
            delta: {
              tool_calls: [{ function: { arguments: '{"city":' }, index: 0 }],
            },
            finish_reason: null,
          },
        ],
      },
      {
        choices: [
          {
            delta: {
              tool_calls: [{ function: { arguments: '"Paris"}' }, index: 0 }],
            },
            finish_reason: "tool_calls",
          },
        ],
      },
    ];

    const processor = new LLMStreamProcessor({
      accumulateNativeToolCalls: true,
    });
    for (const c of chunks) {
      const result = normalizeOpenAIChatChunk(c);
      if (result) {
        processor.process(result.chunk);
      }
    }
    processor.flush();

    const accumulated = processor.accumulatedMessage.toolCalls;
    expect(accumulated).toHaveLength(1);
    const [tc] = accumulated;
    expect(tc?.name).toBe("get_weather");
    expect(tc?.parameters).toStrictEqual({ city: "Paris" });
  });

  it("forwards usage info from the final chunk", () => {
    const chunks = [
      { choices: [{ delta: { content: "hi" }, finish_reason: null }] },
      {
        choices: [{ delta: {}, finish_reason: "stop" }],
        usage: { completion_tokens: 5, prompt_tokens: 10, total_tokens: 15 },
      },
    ];

    const processor = new LLMStreamProcessor();
    for (const c of chunks) {
      const result = normalizeOpenAIChatChunk(c);
      if (result) {
        processor.process(result.chunk);
      }
    }
    const flush = processor.flush();
    expect(flush.usage).toMatchObject({ inputTokens: 10, outputTokens: 5 });
  });
});

// ---------------------------------------------------------------------------
// OpenAI Responses API
// ---------------------------------------------------------------------------

describe("normalizeOpenAIResponseEvent → LLMStreamProcessor", () => {
  it("accumulates response.output_text.delta events", () => {
    const events = [
      { delta: "Hello", type: "response.output_text.delta" },
      { delta: " world", type: "response.output_text.delta" },
      {
        response: { usage: { input_tokens: 5, output_tokens: 2 } },
        type: "response.completed",
      },
    ];

    const processor = new LLMStreamProcessor();
    for (const e of events) {
      const result = normalizeOpenAIResponseEvent(e);
      if (result) {
        processor.process(result.chunk);
      }
    }
    const flush = processor.flush();

    expect(processor.accumulatedMessage.content).toBe("Hello world");
    expect(flush.usage).toMatchObject({ inputTokens: 5, outputTokens: 2 });
  });
});

// ---------------------------------------------------------------------------
// Anthropic Messages API
// ---------------------------------------------------------------------------

describe("normalizeAnthropicEvent → LLMStreamProcessor", () => {
  it("accumulates text content across content_block_delta events", () => {
    const events = [
      { message: { usage: { input_tokens: 20 } }, type: "message_start" },
      {
        content_block: { text: "", type: "text" },
        index: 0,
        type: "content_block_start",
      },
      {
        delta: { text: "Hello", type: "text_delta" },
        index: 0,
        type: "content_block_delta",
      },
      {
        delta: { text: " Claude", type: "text_delta" },
        index: 0,
        type: "content_block_delta",
      },
      { index: 0, type: "content_block_stop" },
      {
        delta: { stop_reason: "end_turn" },
        type: "message_delta",
        usage: { output_tokens: 8 },
      },
      { type: "message_stop" },
    ];

    const { content, done, processor } = pump(events, normalizeAnthropicEvent);
    expect(content).toBe("Hello Claude");
    expect(done).toBeTruthy();
    expect(processor.accumulatedMessage.usage?.inputTokens).toBe(20);
  });

  it("captures thinking_delta as thinking output", () => {
    const events = [
      {
        content_block: { thinking: "", type: "thinking" },
        index: 0,
        type: "content_block_start",
      },
      {
        delta: { thinking: "Let me think", type: "thinking_delta" },
        index: 0,
        type: "content_block_delta",
      },
      { index: 0, type: "content_block_stop" },
      {
        content_block: { text: "", type: "text" },
        index: 1,
        type: "content_block_start",
      },
      {
        delta: { text: "answer", type: "text_delta" },
        index: 1,
        type: "content_block_delta",
      },
      {
        delta: { stop_reason: "end_turn" },
        type: "message_delta",
        usage: { output_tokens: 5 },
      },
    ];

    const { thinking, content } = pump(events, normalizeAnthropicEvent);
    expect(thinking).toBe("Let me think");
    expect(content).toBe("answer");
  });

  it("emits native tool call deltas for tool_use blocks", () => {
    const events = [
      {
        content_block: { id: "tu_1", name: "search", type: "tool_use" },
        index: 0,
        type: "content_block_start",
      },
      {
        delta: { partial_json: '{"q":', type: "input_json_delta" },
        index: 0,
        type: "content_block_delta",
      },
      {
        delta: { partial_json: '"cats"}', type: "input_json_delta" },
        index: 0,
        type: "content_block_delta",
      },
      {
        delta: { stop_reason: "tool_use" },
        type: "message_delta",
        usage: { output_tokens: 10 },
      },
    ];

    const processor = new LLMStreamProcessor({
      accumulateNativeToolCalls: true,
    });
    for (const e of events) {
      const result = normalizeAnthropicEvent(e);
      if (result) {
        processor.process(result.chunk);
      }
    }
    processor.flush();

    expect(processor.accumulatedMessage.toolCalls).toHaveLength(1);
    expect(processor.accumulatedMessage.toolCalls[0]?.name).toBe("search");
    expect(processor.accumulatedMessage.toolCalls[0]?.parameters).toStrictEqual(
      { q: "cats" }
    );
  });
});

// ---------------------------------------------------------------------------
// Gemini GenerateContent SSE
// ---------------------------------------------------------------------------

describe("normalizeGeminiChunk → LLMStreamProcessor", () => {
  it("accumulates text parts across multiple candidates", () => {
    const chunks = [
      {
        candidates: [
          {
            content: { parts: [{ text: "Gemini" }], role: "model" },
            finishReason: null,
          },
        ],
      },
      {
        candidates: [
          {
            content: { parts: [{ text: " says hi" }], role: "model" },
            finishReason: "STOP",
          },
        ],
        usageMetadata: {
          candidatesTokenCount: 3,
          promptTokenCount: 5,
          totalTokenCount: 8,
        },
      },
    ];

    const processor = new LLMStreamProcessor();
    for (const c of chunks) {
      const result = normalizeGeminiChunk(c);
      if (result) {
        processor.process(result.chunk);
      }
    }
    const flush = processor.flush();

    expect(processor.accumulatedMessage.content).toBe("Gemini says hi");
    expect(flush.finishReason).toBe("stop");
    expect(flush.usage).toMatchObject({ inputTokens: 5, outputTokens: 3 });
  });
});

// ---------------------------------------------------------------------------
// Amazon Bedrock Converse
// ---------------------------------------------------------------------------

describe("normalizeBedrockConverseEvent → LLMStreamProcessor", () => {
  it("accumulates contentBlockDelta text deltas", () => {
    const events = [
      { contentBlockStart: { contentBlockIndex: 0, start: { text: "" } } },
      {
        contentBlockDelta: { contentBlockIndex: 0, delta: { text: "Bedrock" } },
      },
      {
        contentBlockDelta: {
          contentBlockIndex: 0,
          delta: { text: " response" },
        },
      },
      { messageStop: { stopReason: "end_turn" } },
    ];

    const { content, done } = pump(events, normalizeBedrockConverseEvent);
    expect(content).toBe("Bedrock response");
    expect(done).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Cohere
// ---------------------------------------------------------------------------

describe("normalizeCohereEvent → LLMStreamProcessor", () => {
  it("accumulates text-generation events", () => {
    const events = [
      {
        delta: { message: { content: { text: "Co" } } },
        index: 0,
        type: "content-delta",
      },
      {
        delta: { message: { content: { text: "here" } } },
        index: 0,
        type: "content-delta",
      },
      { delta: { finish_reason: "COMPLETE" }, type: "message-end" },
    ];

    const { content, done } = pump(events, normalizeCohereEvent);
    expect(content).toBe("Cohere");
    expect(done).toBeTruthy();
  });
});
