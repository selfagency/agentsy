import type { NativeToolCallDelta, NormalizerResult, UsageInfo } from './types.js';

// ---------------------------------------------------------------------------
// Normalizer for OpenAI Responses API streaming events
//
// Event types handled:
//   response.output_text.delta        → chunk.content
//   response.refusal.delta            → chunk.content (refusal text treated as content)
//   response.output_item.added        → nativeToolCallDeltas (function_call items only)
//   response.function_call_arguments.delta → nativeToolCallDeltas
//   response.completed                → chunk.done = true, usage
//
// All other event types return null.
// ---------------------------------------------------------------------------

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function toNumber(v: unknown): number | undefined {
  return typeof v === 'number' ? v : undefined;
}

/**
 * Normalizes a single OpenAI Responses API streaming event into a canonical
 * `NormalizerResult`.  Returns `null` for events that carry no useful
 * consumer-facing data (e.g. `response.created`, `response.in_progress`).
 *
 * Never throws — malformed or adversarial input is silently ignored.
 */
export function normalizeOpenAIResponseEvent(raw: unknown): NormalizerResult | null {
  try {
    if (!isObject(raw)) return null;
    const type = raw['type'];
    if (typeof type !== 'string') return null;

    // -----------------------------------------------------------------------
    // Text / refusal deltas
    // -----------------------------------------------------------------------
    if (type === 'response.output_text.delta' || type === 'response.refusal.delta') {
      const delta = raw['delta'];
      if (typeof delta !== 'string') return null;
      return { chunk: { content: delta }, rawEvent: raw };
    }

    // -----------------------------------------------------------------------
    // Function-call item introduction — captures call_id and name
    // -----------------------------------------------------------------------
    if (type === 'response.output_item.added') {
      const item = raw['item'];
      if (!isObject(item)) return null;
      if (item['type'] !== 'function_call') return null;

      const outputIndex = toNumber(raw['output_index']) ?? 0;
      const callId = typeof item['call_id'] === 'string' ? item['call_id'] : undefined;
      const name = typeof item['name'] === 'string' ? item['name'] : undefined;

      const delta: NativeToolCallDelta = { index: outputIndex };
      if (callId !== undefined) delta.id = callId;
      if (name !== undefined) delta.name = name;

      return { chunk: { nativeToolCallDeltas: [delta] }, rawEvent: raw };
    }

    // -----------------------------------------------------------------------
    // Function-call arguments delta
    // -----------------------------------------------------------------------
    if (type === 'response.function_call_arguments.delta') {
      const argsDelta = raw['delta'];
      if (typeof argsDelta !== 'string') return null;

      const outputIndex = toNumber(raw['output_index']) ?? 0;
      const callId = typeof raw['call_id'] === 'string' ? raw['call_id'] : undefined;

      const delta: NativeToolCallDelta = { index: outputIndex, argumentsDelta: argsDelta };
      if (callId !== undefined) delta.id = callId;

      return { chunk: { nativeToolCallDeltas: [delta] }, rawEvent: raw };
    }

    // -----------------------------------------------------------------------
    // Response completed — carries final usage
    // -----------------------------------------------------------------------
    if (type === 'response.completed') {
      const response = raw['response'];
      let usage: UsageInfo | undefined;

      if (isObject(response) && isObject(response['usage'])) {
        const u = response['usage'];
        usage = {};
        const input = toNumber(u['input_tokens']);
        const output = toNumber(u['output_tokens']);
        const total = toNumber(u['total_tokens']);
        if (input !== undefined) usage.inputTokens = input;
        if (output !== undefined) usage.outputTokens = output;
        if (total !== undefined) usage.totalTokens = total;
      }

      return { chunk: { done: true }, ...(usage !== undefined && { usage }), rawEvent: raw };
    }

    // All other events (response.created, response.in_progress, etc.)
    return null;
  } catch {
    return null;
  }
}
