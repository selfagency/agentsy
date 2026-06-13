/**
 * Stage 4: Context Builder
 *
 * Packs reranked chunks into a token-limited context with citation tracking.
 * Supports relevance, recency, and lost-in-the-middle ordering strategies.
 */

import type { RerankedResult } from '../reranking/index.js';

export type ContextOrdering = 'relevance' | 'recency' | 'lost-in-middle';

export interface CitationEntry {
  chunkId: string;
  source: string;
}

export interface BuiltContext {
  citations: Record<string, CitationEntry>;
  text: string;
  tokenCount: number;
}

export interface ContextBuilderOptions {
  maxTokens?: number;
  ordering?: ContextOrdering;
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export class ContextBuilder {
  build(chunks: RerankedResult[], options: ContextBuilderOptions = {}): BuiltContext {
    const maxTokens = options.maxTokens ?? 4000;
    const ordering = options.ordering ?? 'lost-in-middle';
    const ordered = orderChunks(chunks, ordering);

    const segments: string[] = [];
    const citations: Record<string, CitationEntry> = {};
    let tokenCount = 0;

    for (const chunk of ordered) {
      const segmentTokens = estimateTokens(chunk.content);
      if (tokenCount + segmentTokens > maxTokens) {
        break;
      }
      const chunkId = chunk.id;
      const source = chunkId.split('-')[0] ?? chunkId;
      segments.push(`[${chunkId}] ${chunk.content}`);
      citations[chunkId] = { chunkId, source };
      tokenCount += segmentTokens;
    }

    return { citations, text: segments.join('\n\n'), tokenCount };
  }
}

function orderChunks(chunks: RerankedResult[], ordering: ContextOrdering): RerankedResult[] {
  if (ordering === 'lost-in-middle') {
    return lostInMiddleOrder(chunks);
  }
  if (ordering === 'recency') {
    return [...chunks].sort((a, b) => b.denseScore - a.denseScore);
  }
  return [...chunks].sort((a, b) => b.rerankScore - a.rerankScore);
}

/**
 * Lost-in-the-middle ordering: place most relevant at start and end,
 * less relevant in middle.
 */
export function lostInMiddleOrder(chunks: RerankedResult[]): RerankedResult[] {
  const sorted = [...chunks].sort((a, b) => b.rerankScore - a.rerankScore);
  const result: RerankedResult[] = [];
  let left = 0;
  let right = sorted.length - 1;

  while (left <= right) {
    if (left === right) {
      result.push(sorted[left] as RerankedResult);
      break;
    }
    result.push(sorted[left] as RerankedResult);
    left++;
    if (left <= right) {
      result.push(sorted[right] as RerankedResult);
      right--;
    }
  }

  return result;
}
