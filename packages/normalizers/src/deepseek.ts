import type { FinishReason } from '@agentsy/types';
import type { NativeToolCallDelta, NormalizerResult, UsageInfo } from './types.js';

const DEEPSEEK_FINISH_REASON_MAP: Record<string, FinishReason> = {
  stop: 'stop',
  tool_calls: 'tool-calls',
  length: 'length',
  content_filter: 'content-filter',
  insufficient_balance: 'error',
};

interface DeepSeekToolCallDeltaRaw {
  index: number;
  id?: string;
  function?: {
    name?: string;
    arguments?: string;
  };
}

function mapDeepSeekFinishReason(reason: string | null | undefined): FinishReason | undefined {
  if (!reason) return undefined;
  return DEEPSEEK_FINISH_REASON_MAP[reason] ?? 'other';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function isDeepSeekToolCallDeltaRaw(value: unknown): value is DeepSeekToolCallDeltaRaw {
  return isRecord(value) && typeof value.index === 'number';
}

function toNativeToolCallDelta(raw: DeepSeekToolCallDeltaRaw): NativeToolCallDelta {
  return {
    index: raw.index,
    ...(raw.id ? { id: raw.id } : {}),
    ...(raw.function?.name ? { name: raw.function.name } : {}),
    ...(raw.function?.arguments ? { argumentsDelta: raw.function.arguments } : {}),
  };
}

function normalizeUsage(raw: unknown): UsageInfo | undefined {
  if (raw === null || typeof raw !== 'object') return undefined;
  const usage = raw as Record<string, unknown>;

  const out: UsageInfo = {};
  if (typeof usage.prompt_tokens === 'number') out.inputTokens = usage.prompt_tokens;
  if (typeof usage.completion_tokens === 'number') out.outputTokens = usage.completion_tokens;
  if (typeof usage.total_tokens === 'number') out.totalTokens = usage.total_tokens;

  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Normalizes a DeepSeek streaming chunk.
 * Compatible with DeepSeek-V3 and DeepSeek-R1 (using reasoning_content).
 */
export function normalizeDeepSeekChunk(raw: unknown): NormalizerResult | null {
  if (raw === null || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;

  const choices = data.choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;

  const choice = choices[0] as Record<string, unknown>;
  const delta = (choice.delta as Record<string, unknown>) || {};

  const content = typeof delta.content === 'string' ? delta.content : undefined;
  const thinking = typeof delta.reasoning_content === 'string' ? delta.reasoning_content : undefined;

  let nativeToolCallDeltas: NativeToolCallDelta[] | undefined;
  if (Array.isArray(delta.tool_calls)) {
    nativeToolCallDeltas = delta.tool_calls.filter(isDeepSeekToolCallDeltaRaw).map(toNativeToolCallDelta);
  }

  const finishReason = mapDeepSeekFinishReason(choice.finish_reason as string);
  const usage = normalizeUsage(data.usage);

  return {
    chunk: {
      content,
      thinking,
      nativeToolCallDeltas,
      finishReason,
      usage,
      done: finishReason !== undefined,
    },
    rawEvent: raw,
  };
}
