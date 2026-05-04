import type { FinishReason } from '../tool-calls/types.js';
import type { NativeToolCallDelta, NormalizerResult, UsageInfo } from './types.js';

function mapZAiFinishReason(reason: string | null | undefined): FinishReason | undefined {
  if (!reason) return undefined;
  if (reason === 'stop') return 'stop';
  if (reason === 'tool_calls') return 'tool-calls';
  if (reason === 'length') return 'length';
  if (reason === 'sensitive') return 'content-filter';
  if (reason === 'model_context_window_exceeded') return 'error';
  if (reason === 'network_error') return 'error';
  return 'other';
}

interface ZAiToolCallDelta {
  index: number;
  id?: string | null;
  function?: { name?: string | null; arguments?: string | null };
}

interface ZAiChoice {
  index?: number;
  finish_reason?: string | null;
  delta?: {
    content?: string | null;
    reasoning_content?: string | null;
    tool_calls?: ZAiToolCallDelta[];
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function mapToolCallDelta(delta: ZAiToolCallDelta): NativeToolCallDelta {
  const mapped: NativeToolCallDelta = { index: delta.index };
  if (typeof delta.id === 'string' && delta.id.length > 0) {
    mapped.id = delta.id;
  }
  if (typeof delta.function?.name === 'string' && delta.function.name.length > 0) {
    mapped.name = delta.function.name;
  }
  if (typeof delta.function?.arguments === 'string' && delta.function.arguments.length > 0) {
    mapped.argumentsDelta = delta.function.arguments;
  }
  return mapped;
}

function normalizeUsage(raw: unknown): UsageInfo | undefined {
  if (!isRecord(raw)) return undefined;

  const usage: UsageInfo = {};

  if (typeof raw.prompt_tokens === 'number') usage.inputTokens = raw.prompt_tokens;
  if (typeof raw.completion_tokens === 'number') usage.outputTokens = raw.completion_tokens;
  if (typeof raw.total_tokens === 'number') usage.totalTokens = raw.total_tokens;

  if (typeof raw.input_tokens === 'number') usage.inputTokens = raw.input_tokens;
  if (typeof raw.output_tokens === 'number') usage.outputTokens = raw.output_tokens;

  if (
    typeof usage.inputTokens === 'number' &&
    typeof usage.outputTokens === 'number' &&
    usage.totalTokens === undefined
  ) {
    usage.totalTokens = usage.inputTokens + usage.outputTokens;
  }

  return Object.keys(usage).length > 0 ? usage : undefined;
}

/**
 * Normalizes a Z.ai streaming chunk into canonical `NormalizerResult`.
 *
 * Handles OpenAI-compatible chunk envelopes while centralizing Z.ai-specific
 * finish-reason mapping and tolerant usage extraction.
 */
export function normalizeZAiChunk(raw: unknown): NormalizerResult | null {
  try {
    if (!isRecord(raw)) return null;
    const choicesUnknown = raw.choices;
    if (!Array.isArray(choicesUnknown) || choicesUnknown.length === 0) return null;

    const choice = choicesUnknown[0] as ZAiChoice;
    const delta = isRecord(choice.delta) ? choice.delta : undefined;

    const content = typeof delta?.content === 'string' ? delta.content : undefined;
    const thinking = typeof delta?.reasoning_content === 'string' ? delta.reasoning_content : undefined;

    let nativeToolCallDeltas: NativeToolCallDelta[] | undefined;
    if (Array.isArray(delta?.tool_calls) && delta.tool_calls.length > 0) {
      nativeToolCallDeltas = delta.tool_calls
        .filter(tc => isRecord(tc) && typeof tc.index === 'number')
        .map(tc => mapToolCallDelta(tc as ZAiToolCallDelta));
    }

    const mappedFinishReason = mapZAiFinishReason(choice.finish_reason ?? null);
    const done = choice.finish_reason !== null && choice.finish_reason !== undefined ? true : undefined;
    const usage = normalizeUsage(raw.usage);

    const chunk = {
      ...(content !== undefined ? { content } : {}),
      ...(thinking !== undefined ? { thinking } : {}),
      ...(nativeToolCallDeltas !== undefined ? { nativeToolCallDeltas } : {}),
      ...(done !== undefined ? { done } : {}),
      ...(mappedFinishReason !== undefined ? { finishReason: mappedFinishReason } : {}),
      ...(usage !== undefined ? { usage } : {}),
    };

    if (Object.keys(chunk).length === 0) return null;
    return { chunk, rawEvent: raw };
  } catch {
    return null;
  }
}
