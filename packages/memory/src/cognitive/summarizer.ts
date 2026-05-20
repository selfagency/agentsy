import type { MemoryItem, WriteHeap } from './tier-types.js';

export interface Summarizer {
  summarize(items: MemoryItem[], budget: number): SummarizeResult;
}

export interface SummarizeResult {
  longTermItems: MemoryItem[];
  metaActions: MetaAction[];
  discarded: MemoryItem[];
  tokenReduction: number;
}

export interface MetaAction {
  id: string;
  pattern: string;
  frequency: number;
  lastObserved: number;
  sourceIds: string[];
}

export interface SummarizerOptions {
  now?: (() => number) | undefined;
  maxGroupSize?: number;
}

const HEURISTIC_PATTERNS: Record<string, (content: string) => string | null> = {
  error: c => {
    const match = c.match(/\b(?:error|exception|fail)\b[^.]*\./iu);
    return match ? (match[0] ?? null) : null;
  },
  action: c => {
    const match = c.match(/\b(?:created|updated|deleted|added|removed|configured)\b[^.]*\./iu);
    return match ? (match[0] ?? null) : null;
  },
  query: c => {
    const match = c.match(/\b(?:search|find|query|lookup|retrieve)\b[^.]*\./iu);
    return match ? (match[0] ?? null) : null;
  }
};

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function classifyWriteHeap(content: string): WriteHeap {
  if (/\b(error|exception|fail|warning)\b/iu.test(content)) return 'event';
  if (/\b(search|find|query|lookup)\b/iu.test(content)) return 'query';
  if (/\b(created|updated|deleted|added|removed)\b/iu.test(content)) return 'event';
  if (/\b(doc|readme|guide|reference|spec)\b/iu.test(content)) return 'doc';
  return 'ref';
}

function extractPatterns(items: MemoryItem[], now: number): MetaAction[] {
  const patternFreq = new Map<string, { count: number; lastObserved: number; sourceIds: string[] }>();

  for (const item of items) {
    for (const [name, extractor] of Object.entries(HEURISTIC_PATTERNS)) {
      const match = extractor(item.content);
      if (match) {
        const key = `${name}:${match.slice(0, 60)}`;
        const existing = patternFreq.get(key);
        if (existing) {
          existing.count += 1;
          existing.lastObserved = Math.max(existing.lastObserved, now);
          existing.sourceIds.push(item.id);
        } else {
          patternFreq.set(key, {
            count: 1,
            lastObserved: now,
            sourceIds: [item.id]
          });
        }
      }
    }
  }

  return [...patternFreq.entries()].map(([key, data]) => ({
    id: `meta-${key.slice(0, 20)}`,
    pattern: key,
    frequency: data.count,
    lastObserved: data.lastObserved,
    sourceIds: data.sourceIds
  }));
}

function summarizeGroup(items: MemoryItem[], _now: number): string {
  // Rule-based summarization: extract key sentences
  const sentences: string[] = [];
  for (const item of items) {
    const itemSentences = item.content
      .split(/[.!?]+/u)
      .map(s => s.trim())
      .filter(s => s.length > 10);
    sentences.push(...itemSentences.slice(0, 3));
  }

  // Deduplicate and take top sentences
  const unique = [...new Set(sentences)];
  return unique.slice(0, 5).join('. ') + '.';
}

export function createSummarizer(options: SummarizerOptions = {}): Summarizer {
  const now = options.now ?? (() => performance.now());
  const maxGroupSize = options.maxGroupSize ?? 10;

  return {
    summarize(items: MemoryItem[], budget: number): SummarizeResult {
      if (items.length === 0) {
        return { longTermItems: [], metaActions: [], discarded: [], tokenReduction: 0 };
      }

      const currentNow = now();
      const metaActions = extractPatterns(items, currentNow);

      // Group items by writeHeap for organized summarization
      const byHeap = new Map<WriteHeap, MemoryItem[]>();
      for (const item of items) {
        const heap = classifyWriteHeap(item.content);
        const group = byHeap.get(heap);
        if (group) {
          group.push(item);
        } else {
          byHeap.set(heap, [item]);
        }
      }

      const longTermItems: MemoryItem[] = [];
      const discarded: MemoryItem[] = [];
      let usedTokens = 0;
      let originalTokens = 0;

      for (const item of items) {
        originalTokens += item.tokenCount;
      }

      for (const [heap, group] of byHeap) {
        // Process in batches of maxGroupSize
        for (let i = 0; i < group.length; i += maxGroupSize) {
          const batch = group.slice(i, i + maxGroupSize);
          const summary = summarizeGroup(batch, currentNow);
          const tokenCount = estimateTokens(summary);

          if (usedTokens + tokenCount > budget) {
            // Keep highest-importance items that fit
            const sorted = [...batch].sort((a, b) => b.importance - a.importance);
            for (const item of sorted) {
              if (usedTokens + item.tokenCount <= budget) {
                longTermItems.push({
                  ...item,
                  writeHeap: heap,
                  metadata: { ...item.metadata, _summarized: false }
                });
                usedTokens += item.tokenCount;
              } else {
                discarded.push(item);
              }
            }
            continue;
          }

          const sourceIds = batch.map(i => i.id);
          const maxImportance = Math.max(...batch.map(i => i.importance));
          const firstBatchItem = batch[0];
          if (!firstBatchItem) continue;

          longTermItems.push({
            id: `ltm-summary-${heap}-${i}`,
            kind: 'semantic',
            content: summary,
            tokenCount,
            importance: Math.min(1, maxImportance + 0.05),
            writeHeap: heap,
            reuseClass: 'cold',
            createdAt: firstBatchItem.createdAt,
            lastAccessedAt: currentNow,
            accessCount: batch.reduce((sum, item) => sum + item.accessCount, 0),
            fingerprint: `ltm-${batch.map(i => i.fingerprint).join('+')}`,
            metadata: {
              sourceIds,
              _summarized: true
            }
          });

          usedTokens += tokenCount;
        }
      }

      const tokenReduction = originalTokens === 0 ? 0 : (originalTokens - usedTokens) / originalTokens;

      return { longTermItems, metaActions, discarded, tokenReduction };
    }
  };
}
