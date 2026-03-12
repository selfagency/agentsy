import type { NormalizerResult } from './types.js';
import { normalizeOpenAIChatChunk } from './openai.js';

/**
 * Normalizes a Mistral AI streaming chunk into a canonical `NormalizerResult`.
 *
 * Mistral's streaming API is OpenAI Chat Completions-compatible (same JSON
 * shape: `choices[0].delta`, `finish_reason`, optional `usage` on final
 * chunk).  This function delegates directly to `normalizeOpenAIChatChunk`.
 *
 * Returns `null` for unrecognizable chunks.  Never throws.
 */
export function normalizeMistralChunk(raw: unknown): NormalizerResult | null {
  return normalizeOpenAIChatChunk(raw);
}
