import { normalizeOpenAIChatChunk } from './openai.js';
import type { NormalizerResult } from './types.js';

export const OPENAI_COMPATIBLE_NORMALIZER_PROVIDERS = ['openai', 'kimi', 'qwen', 'llama', 'granite'] as const;

export type OpenAICompatibleNormalizerProvider = (typeof OPENAI_COMPATIBLE_NORMALIZER_PROVIDERS)[number];

export function isOpenAICompatibleNormalizerProvider(value: string): value is OpenAICompatibleNormalizerProvider {
  return (OPENAI_COMPATIBLE_NORMALIZER_PROVIDERS as readonly string[]).includes(value);
}

/**
 * Shared normalizer for providers that emit OpenAI-compatible chat chunks.
 */
export function normalizeOpenAICompatibleChunk(
  _provider: OpenAICompatibleNormalizerProvider,
  raw: unknown
): NormalizerResult | null {
  return normalizeOpenAIChatChunk(raw);
}
