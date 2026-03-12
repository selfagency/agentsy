import type { NativeToolCallDelta, NormalizerResult, UsageInfo } from './types.js';

// ---------------------------------------------------------------------------
// Internal shape types (narrow enough for safe access without `any`)
// ---------------------------------------------------------------------------

interface OpenAIToolCallDelta {
  index: number;
  id?: string | null;
  type?: string;
  function?: { name?: string | null; arguments?: string | null };
}

interface OpenAIDelta {
  role?: string;
  content?: string | null;
  reasoning_content?: string | null;
  tool_calls?: OpenAIToolCallDelta[];
}

interface OpenAIChoice {
  index: number;
  delta: OpenAIDelta;
  finish_reason: string | null;
}

interface OpenAIUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

interface OpenAIChatChunk {
  id?: string;
  object?: string;
  created?: number;
  model?: string;
  choices: OpenAIChoice[];
  usage?: OpenAIUsage | null;
}

// ---------------------------------------------------------------------------
// Type guard
// ---------------------------------------------------------------------------

function isOpenAIChatChunk(value: unknown): value is OpenAIChatChunk {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  // Accept if object field matches, or if there's a choices array (permissive
  // for providers that use OpenAI-compatible formats without the object field).
  if (v['object'] !== undefined && v['object'] !== 'chat.completion.chunk') return false;
  if (!Array.isArray(v['choices'])) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Normalizer
// ---------------------------------------------------------------------------

/**
 * Normalizes an OpenAI Chat Completions streaming chunk into a canonical
 * `NormalizerResult`.  Returns `null` if the chunk is not recognizable as an
 * OpenAI Chat Completions chunk.
 *
 * Never throws — malformed or adversarial input is silently skipped.
 */
export function normalizeOpenAIChatChunk(raw: unknown): NormalizerResult | null {
  try {
    if (!isOpenAIChatChunk(raw)) return null;

    const choice = raw.choices[0];
    const delta = choice?.delta;

    const content = typeof delta?.content === 'string' ? delta.content : undefined;
    const thinking = typeof delta?.reasoning_content === 'string' ? delta.reasoning_content : undefined;

    const finishReason = choice?.finish_reason;
    const done = finishReason === 'stop' || finishReason === 'tool_calls' ? true : undefined;

    // Native tool call deltas
    let nativeToolCallDeltas: NativeToolCallDelta[] | undefined;
    if (Array.isArray(delta?.tool_calls) && delta.tool_calls.length > 0) {
      nativeToolCallDeltas = delta.tool_calls
        .filter((tc): tc is OpenAIToolCallDelta => !!tc && typeof tc === 'object')
        .map(tc => {
          const delta: NativeToolCallDelta = { index: tc.index ?? 0 };
          if (tc.id) delta.id = tc.id;
          if (tc.function?.name) delta.name = tc.function.name;
          if (typeof tc.function?.arguments === 'string' && tc.function.arguments !== '') {
            delta.argumentsDelta = tc.function.arguments;
          }
          return delta;
        });
    }

    // Usage — only present on the final chunk when stream_options.include_usage=true
    let usage: UsageInfo | undefined;
    if (raw.usage) {
      usage = {};
      if (typeof raw.usage.prompt_tokens === 'number') usage.inputTokens = raw.usage.prompt_tokens;
      if (typeof raw.usage.completion_tokens === 'number') usage.outputTokens = raw.usage.completion_tokens;
      if (typeof raw.usage.total_tokens === 'number') usage.totalTokens = raw.usage.total_tokens;
    }

    const chunk = {
      ...(content !== undefined && { content }),
      ...(thinking !== undefined && { thinking }),
      ...(done !== undefined && { done }),
      ...(nativeToolCallDeltas !== undefined && { nativeToolCallDeltas }),
    };

    return { chunk, ...(usage !== undefined && { usage }), rawEvent: raw };
  } catch {
    return null;
  }
}
