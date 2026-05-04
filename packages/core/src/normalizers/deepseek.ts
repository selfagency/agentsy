import type { FinishReason } from '../tool-calls/types.js';
import type { NativeToolCallDelta, NormalizerResult, UsageInfo } from './types.js';

function mapDeepSeekFinishReason(reason: string | null | undefined): FinishReason | undefined {
  if (!reason) return undefined;
  if (reason === 'stop') return 'stop';
  if (reason === 'tool_calls') return 'tool-calls';
  if (reason === 'length') return 'length';
  if (reason === 'content_filter') return 'content-filter';
  if (reason === 'insufficient_balance') return 'error';
  return 'other';
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
    nativeToolCallDeltas = delta.tool_calls.map((tc: any) => ({
      index: tc.index,
      id: tc.id || undefined,
      name: tc.function?.name || undefined,
      argumentsDelta: tc.function?.arguments || undefined,
    }));
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
