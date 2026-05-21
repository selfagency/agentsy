import { fingerprintContent } from '../content-addressing/fingerprint.js';
import { createContentProcessor } from '../wiki/content-processor.js';
import type { MemoryItem, TierName, WriteHeap } from './tier-types.js';

export interface Compressor {
  compress(items: MemoryItem[], budget: number): CompressResult;
}

export interface CompressResult {
  chunks: MemoryItem[];
  discarded: MemoryItem[];
  tokenReduction: number;
}

export interface CompressorOptions {
  targetTierName?: TierName;
  now?: (() => number) | undefined;
}

const CONTENT_TYPE_WEIGHTS: Record<WriteHeap, number> = {
  doc: 0.9,
  event: 0.7,
  query: 0.6,
  ref: 0.5
};

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function computeInitialImportance(item: MemoryItem, now: number): number {
  const ageMs = Math.max(0, now - item.createdAt);
  const recencyWeight = 1 / (1 + ageMs / 30_000);
  const writeHeapWeight = CONTENT_TYPE_WEIGHTS[item.writeHeap as WriteHeap] ?? 0.5;
  const score = item.importance * 0.4 + recencyWeight * 0.3 + writeHeapWeight * 0.3;
  return Math.min(1, Math.max(0, score));
}

export function createCompressor(options: CompressorOptions = {}): Compressor {
  const now = options.now ?? (() => performance.now());
  const contentProcessor = createContentProcessor();

  return {
    compress(items: MemoryItem[], budget: number): CompressResult {
      if (items.length === 0) {
        return { chunks: [], discarded: [], tokenReduction: 0 };
      }

      const currentNow = now();
      const scored = items.map(item => ({
        item,
        score: computeInitialImportance(item, currentNow)
      }));

      scored.sort((a, b) => b.score - a.score);

      const chunks: MemoryItem[] = [];
      const discarded: MemoryItem[] = [];
      let usedTokens = 0;
      let originalTokens = 0;

      for (const { item, score } of scored) {
        originalTokens += item.tokenCount;

        if (usedTokens + item.tokenCount > budget) {
          discarded.push(item);
          continue;
        }

        const fp = fingerprintContent(item.content);
        const normalized = contentProcessor.normalize(item.content);
        const tokenCount = estimateTokens(normalized);

        chunks.push({
          ...item,
          content: normalized,
          importance: score,
          tokenCount,
          fingerprint: fp.value,
          lastAccessedAt: currentNow,
          metadata: { ...item.metadata, _compressed: true }
        });

        usedTokens += tokenCount;
      }

      const tokenReduction = originalTokens === 0 ? 0 : (originalTokens - usedTokens) / originalTokens;

      return { chunks, discarded, tokenReduction };
    }
  };
}
