import type { FinishReason } from '@agentsy/types';

import type { NativeToolCallDelta, NormalizerResult, UsageInfo } from './types.js';

function mapOpenAIFinishReason(reason: string | null | undefined): FinishReason | undefined {
  if (!reason) {
    return undefined;
  }
  if (reason === 'stop') {
    return 'stop';
  }
  if (reason === 'length') {
    return 'length';
  }
  if (reason === 'tool_calls' || reason === 'function_call') {
    return 'tool-calls';
  }
  if (reason === 'content_filter') {
    return 'content-filter';
  }
  return 'other';
}

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
  if (!value || typeof value !== 'object') {
    return false;
  }
  const v = value as Record<string, unknown>;
  // Accept if object field matches, or if there's a choices array (permissive
  // for providers that use OpenAI-compatible formats without the object field).
  if (v.object !== undefined && v.object !== 'chat.completion.chunk') {
    return false;
  }
  if (!Array.isArray(v.choices)) {
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapOpenAIToolCallDelta(tc: OpenAIToolCallDelta): NativeToolCallDelta {
  const result: NativeToolCallDelta = { index: tc.index };
  if (tc.id) {
    result.id = tc.id;
  }
  if (tc.function?.name) {
    result.name = tc.function.name;
  }
  if (typeof tc.function?.arguments === 'string' && tc.function.arguments !== '') {
    result.argumentsDelta = tc.function.arguments;
  }
  return result;
}

function getContentParts(delta: OpenAIDelta | undefined): {
  content?: string;
  thinking?: string;
} {
  const content = typeof delta?.content === 'string' ? delta.content : undefined;
  const thinking = typeof delta?.reasoning_content === 'string' ? delta.reasoning_content : undefined;
  const out: { content?: string; thinking?: string } = {};
  if (content !== undefined) {
    out.content = content;
  }
  if (thinking !== undefined) {
    out.thinking = thinking;
  }
  return out;
}

function getFinishReasonParts(choice: OpenAIChoice | undefined): {
  done?: true;
  finishReason?: FinishReason;
} {
  const finishReason = choice?.finish_reason;
  const mappedFinishReason = mapOpenAIFinishReason(finishReason);
  const out: { done?: true; finishReason?: FinishReason } = {};
  if (finishReason !== null && finishReason !== undefined) {
    out.done = true;
  }
  if (mappedFinishReason !== undefined) {
    out.finishReason = mappedFinishReason;
  }
  return out;
}

function getNativeToolCallDeltas(delta: OpenAIDelta | undefined): NativeToolCallDelta[] | undefined {
  const toolCalls = delta?.tool_calls;
  if (Array.isArray(toolCalls) && toolCalls.length > 0) {
    return toolCalls
      .filter((tc): tc is OpenAIToolCallDelta => tc && typeof tc === 'object')
      .map(mapOpenAIToolCallDelta);
  }

  return undefined;
}

function getUsageParts(raw: OpenAIChatChunk): { usage?: UsageInfo } {
  if (raw.usage) {
    const usage: UsageInfo = {};
    if (typeof raw.usage.prompt_tokens === 'number') {
      usage.inputTokens = raw.usage.prompt_tokens;
    }
    if (typeof raw.usage.completion_tokens === 'number') {
      usage.outputTokens = raw.usage.completion_tokens;
    }
    if (typeof raw.usage.total_tokens === 'number') {
      usage.totalTokens = raw.usage.total_tokens;
    }
    return { usage };
  }

  return {};
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
    if (isOpenAIChatChunk(raw)) {
      const choice = raw.choices[0];
      const delta = choice?.delta;
      const nativeToolCallDeltas = getNativeToolCallDeltas(delta);

      const chunk: Record<string, unknown> = {
        ...getContentParts(delta),
        ...getFinishReasonParts(choice),
        ...getUsageParts(raw)
      };
      if (nativeToolCallDeltas !== undefined) {
        chunk.nativeToolCallDeltas = nativeToolCallDeltas;
      }

      return { chunk, rawEvent: raw };
    }

    return null;
  } catch {
    return null;
  }
}
