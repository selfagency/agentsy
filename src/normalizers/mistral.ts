import type { NormalizerResult } from './types.js';
import { normalizeOpenAIChatChunk } from './openai.js';

/**
 * Normalizes a Mistral AI streaming chunk into a canonical `NormalizerResult`.
 *
 * Most Mistral models use an OpenAI Chat Completions-compatible format and are
 * handled by `normalizeOpenAIChatChunk`.
 *
 * Native reasoning models (`magistral-*`) and models with adjustable reasoning
 * (`reasoning_effort`) use a structured content array in the delta instead of a
 * plain string:
 *
 * ```json
 * { "type": "thinking", "thinking": [{ "type": "text", "text": "..." }] }
 * { "type": "text", "text": "..." }
 * ```
 *
 * This function detects that format and extracts `content` and `thinking`
 * accordingly, merging with any tool-call or usage data from the standard path.
 *
 * Returns `null` for unrecognizable chunks.  Never throws.
 */
export function normalizeMistralChunk(raw: unknown): NormalizerResult | null {
  const standard = normalizeOpenAIChatChunk(raw);

  // Fast path: standard normalization already extracted content or thinking.
  if (standard?.chunk.content !== undefined || standard?.chunk.thinking !== undefined) {
    return standard;
  }

  // Slow path: check for Mistral's structured content array (2509/2507 format).
  try {
    if (!raw || typeof raw !== 'object') return standard;
    const choices = (raw as Record<string, unknown>)['choices'];
    if (!Array.isArray(choices) || choices.length === 0) return standard;

    const delta = (choices[0] as Record<string, unknown>)['delta'] as Record<string, unknown> | undefined;
    if (!Array.isArray(delta?.['content'])) return standard;

    let text = '';
    let thinking = '';

    for (const block of delta['content'] as unknown[]) {
      if (!block || typeof block !== 'object') continue;
      const b = block as Record<string, unknown>;

      if (b['type'] === 'text' && typeof b['text'] === 'string') {
        text += b['text'];
      } else if (b['type'] === 'thinking' && Array.isArray(b['thinking'])) {
        for (const t of b['thinking'] as unknown[]) {
          if (t && typeof t === 'object') {
            const inner = t as Record<string, unknown>;
            if (typeof inner['text'] === 'string') thinking += inner['text'];
          }
        }
      }
    }

    if (!text && !thinking) return standard;

    const base = standard ?? { chunk: {}, rawEvent: raw };
    return {
      chunk: {
        ...base.chunk,
        ...(text && { content: text }),
        ...(thinking && { thinking }),
      },
      rawEvent: raw,
    };
  } catch {
    return standard;
  }
}
