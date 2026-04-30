import type { NativeToolCallDelta, NormalizerResult, UsageInfo } from './types.js';

// ---------------------------------------------------------------------------
// Internal shape types
// ---------------------------------------------------------------------------

interface CohereDeltaMessage {
  content?: { text?: string };
  tool_plan?: string;
  tool_calls?: {
    id?: string;
    type?: string;
    function?: { name?: string; arguments?: string };
  };
}

interface CohereDelta {
  message?: CohereDeltaMessage;
  finish_reason?: string;
  usage?: {
    billed_units?: { input_tokens?: number; output_tokens?: number };
    tokens?: { input_tokens?: number; output_tokens?: number };
  };
}

interface CohereEvent {
  type: string;
  index?: number;
  delta?: CohereDelta;
}

// ---------------------------------------------------------------------------
// Type guard
// ---------------------------------------------------------------------------

function isCohereEvent(value: unknown): value is CohereEvent {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v['type'] === 'string';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildCohereUsage(delta: CohereDelta | undefined): UsageInfo | undefined {
  const tokens = delta?.usage?.tokens;
  if (!tokens) return undefined;
  const usage: UsageInfo = {};
  if (typeof tokens.input_tokens === 'number') usage.inputTokens = tokens.input_tokens;
  if (typeof tokens.output_tokens === 'number') usage.outputTokens = tokens.output_tokens;
  return usage;
}

// ---------------------------------------------------------------------------
// Normalizer
// ---------------------------------------------------------------------------

/**
 * Normalizes a Cohere v2 Chat streaming event into a canonical
 * `NormalizerResult`.
 *
 * Handled event types:
 * - `content-delta` → `chunk.content`
 * - `tool-plan-delta` → `chunk.thinking` (pre-tool reasoning)
 * - `tool-call-start` → `chunk.nativeToolCallDeltas` (id + name)
 * - `tool-call-delta` → `chunk.nativeToolCallDeltas` (argumentsDelta)
 * - `message-end` → `chunk.done`, usage from `delta.usage.tokens`
 *
 * Returns `null` for informational events (`message-start`, `content-start`,
 * `content-end`, `citation-start`, etc.) and unrecognizable input.
 * Never throws.
 */
export function normalizeCohereEvent(raw: unknown): NormalizerResult | null {
  try {
    if (!isCohereEvent(raw)) return null;

    const { type, index = 0, delta } = raw;

    switch (type) {
      case 'content-delta': {
        const text = delta?.message?.content?.text;
        if (typeof text !== 'string') return null;
        return { chunk: { content: text }, rawEvent: raw };
      }

      case 'tool-plan-delta': {
        const toolPlan = delta?.message?.tool_plan;
        if (typeof toolPlan !== 'string') return null;
        return { chunk: { thinking: toolPlan }, rawEvent: raw };
      }

      case 'tool-call-start': {
        const tc = delta?.message?.tool_calls;
        if (!tc || typeof tc !== 'object') return null;
        const normalizedDelta: NativeToolCallDelta = { index };
        if (typeof tc.id === 'string' && tc.id) normalizedDelta.id = tc.id;
        if (typeof tc.function?.name === 'string' && tc.function.name) normalizedDelta.name = tc.function.name;
        return { chunk: { nativeToolCallDeltas: [normalizedDelta] }, rawEvent: raw };
      }

      case 'tool-call-delta': {
        const args = delta?.message?.tool_calls?.function?.arguments;
        if (typeof args !== 'string' || args === '') return null;
        const normalizedDelta: NativeToolCallDelta = { index, argumentsDelta: args };
        return { chunk: { nativeToolCallDeltas: [normalizedDelta] }, rawEvent: raw };
      }

      case 'message-end': {
        const done = typeof delta?.finish_reason === 'string' ? true : undefined;
        const usage = buildCohereUsage(delta);
        return {
          chunk: { ...(done !== undefined && { done }), ...(usage !== undefined && { usage }) },
          rawEvent: raw,
        };
      }

      default:
        return null;
    }
  } catch {
    return null;
  }
}
