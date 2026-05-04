import type { XmlToolCall } from '@agentsy/tool-calls';
import type { JsonObject, StreamChunk } from '@agentsy/types';

export function ensureText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function estimateChunkSize(chunk: StreamChunk, encoder: TextEncoder): number {
  let size = 0;
  if (typeof chunk.content === 'string') size += encoder.encode(chunk.content).length;
  if (typeof chunk.thinking === 'string') size += encoder.encode(chunk.thinking).length;
  if (Array.isArray(chunk.tool_calls)) {
    for (const call of chunk.tool_calls) {
      try {
        size += JSON.stringify(call).length;
      } catch {
        // Skip serialization errors (circular refs, BigInt, etc.)
      }
    }
  }
  if (Array.isArray(chunk.nativeToolCallDeltas)) {
    for (const delta of chunk.nativeToolCallDeltas) {
      try {
        size += JSON.stringify(delta).length;
      } catch {
        // Skip serialization errors
      }
    }
  }
  return size;
}

export function normalizeToolArguments(value: unknown): JsonObject {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as JsonObject;
  }

  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as JsonObject;
      }
    } catch {
      // Ignore malformed tool argument payloads; treat as empty args.
    }
  }

  return {};
}

export function mapNativeToolCalls(calls: StreamChunk['tool_calls']): XmlToolCall[] {
  if (!Array.isArray(calls) || calls.length === 0) {
    return [];
  }

  const mapped: XmlToolCall[] = [];

  for (const call of calls) {
    const name = typeof call?.function?.name === 'string' ? call.function.name : null;
    if (!name) {
      continue;
    }

    mapped.push({
      name,
      parameters: normalizeToolArguments(call.function?.arguments),
      format: 'native-json',
    });
  }

  return mapped;
}

export function enforceMaxLength(
  value: string,
  field: 'content' | 'thinking',
  maxInputLength: number,
  onWarning: (message: string, context?: Record<string, unknown>) => void,
): string {
  if (maxInputLength <= 0 || value.length <= maxInputLength) {
    return value;
  }

  onWarning(`Chunk ${field} exceeded maxInputLength and was truncated`, {
    field,
    maxInputLength,
    originalLength: value.length,
  });

  // Truncate at a tag boundary so we don't hand a partial `<tag...` fragment
  // to the XML parser. Walk back from the cut point to the last `<` that has
  // no matching `>` after it within the kept region.
  let cut = maxInputLength;
  const openIdx = value.lastIndexOf('<', maxInputLength - 1);
  if (openIdx !== -1) {
    const closeIdx = value.indexOf('>', openIdx);
    // If the closing `>` is beyond the cut (or absent), the tag is partial.
    if (closeIdx === -1 || closeIdx >= maxInputLength) {
      cut = openIdx;
    }
  }

  return value.slice(0, cut);
}
