import type { NativeToolCallDelta, NormalizerResult, UsageInfo } from './types.js';
import { isObject, toNumber } from './utils.js';

// ---------------------------------------------------------------------------
// Normalizer for Google Gemini generateContent streaming chunks
//
// Handles the REST streaming response format (application/x-ndjson or SSE).
// Each chunk is a generateContentResponse JSON object.
//
// Part types handled within candidates[0].content.parts:
//   { text: string }                       → chunk.content (concatenated)
//   { thought: true, text: string }        → chunk.thinking (concatenated, Gemini 2.0+)
//   { functionCall: { name, args } }       → nativeToolCallDeltas
//
// finishReason STOP / MAX_TOKENS / SAFETY / RECITATION / OTHER → done: true
// usageMetadata → usage
// ---------------------------------------------------------------------------

const FINISH_REASONS_DONE = new Set(['STOP', 'MAX_TOKENS', 'SAFETY', 'RECITATION', 'OTHER']);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface GeminiPartsResult {
  textContent: string | undefined;
  thinking: string | undefined;
  nativeToolCallList: NativeToolCallDelta[];
}

function processGeminiParts(parts: unknown[]): GeminiPartsResult {
  let textContent: string | undefined;
  let thinking: string | undefined;
  const nativeToolCallList: NativeToolCallDelta[] = [];
  let toolCallIndex = 0;

  for (const part of parts) {
    if (!isObject(part)) continue;

    if (part['thought'] === true && typeof part['text'] === 'string') {
      thinking = (thinking ?? '') + part['text'];
      continue;
    }

    if (typeof part['text'] === 'string') {
      textContent = (textContent ?? '') + part['text'];
      continue;
    }

    const fc = part['functionCall'];
    if (isObject(fc)) {
      const name = typeof fc['name'] === 'string' ? fc['name'] : undefined;
      const args = fc['args'];
      const delta: NativeToolCallDelta = { index: toolCallIndex++ };
      if (name !== undefined) delta.name = name;
      if (args !== undefined) delta.argumentsDelta = JSON.stringify(args);
      nativeToolCallList.push(delta);
    }
  }

  return { textContent, thinking, nativeToolCallList };
}

function extractGeminiUsage(raw: Record<string, unknown>): UsageInfo | undefined {
  const usageMetadata = raw['usageMetadata'];
  if (!isObject(usageMetadata)) return undefined;
  const usage: UsageInfo = {};
  const input = toNumber(usageMetadata['promptTokenCount']);
  const output = toNumber(usageMetadata['candidatesTokenCount']);
  const total = toNumber(usageMetadata['totalTokenCount']);
  if (input !== undefined) usage.inputTokens = input;
  if (output !== undefined) usage.outputTokens = output;
  if (total !== undefined) usage.totalTokens = total;
  return usage;
}

// ---------------------------------------------------------------------------
// Normalizer
// ---------------------------------------------------------------------------

/**
 * Normalizes a Google Gemini `generateContent` streaming chunk into a
 * canonical `NormalizerResult`.  Returns `null` if the chunk has no
 * `candidates` array or the first candidate has no content.
 *
 * Never throws — malformed or adversarial input is silently ignored.
 */
export function normalizeGeminiChunk(raw: unknown): NormalizerResult | null {
  try {
    if (!isObject(raw)) return null;
    if (!Array.isArray(raw['candidates']) || raw['candidates'].length === 0) return null;

    const candidate = raw['candidates'][0];
    if (!isObject(candidate)) return null;

    const content = candidate['content'];
    const finishReason = typeof candidate['finishReason'] === 'string' ? candidate['finishReason'] : null;
    const done = finishReason !== null && FINISH_REASONS_DONE.has(finishReason) ? true : undefined;

    const parts = isObject(content) && Array.isArray(content['parts']) ? (content['parts'] as unknown[]) : [];
    const { textContent, thinking, nativeToolCallList } = processGeminiParts(parts);
    const usage = extractGeminiUsage(raw);

    const chunk = {
      ...(textContent !== undefined && { content: textContent }),
      ...(thinking !== undefined && { thinking }),
      ...(done !== undefined && { done }),
      ...(nativeToolCallList.length > 0 && { nativeToolCallDeltas: nativeToolCallList }),
      ...(usage !== undefined && { usage }),
    };

    return { chunk, rawEvent: raw };
  } catch {
    return null;
  }
}
