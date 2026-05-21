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
    const match = /\b(?:error|exception|fail)\b[^.]*\./iu.exec(c);
    return match ? (match[0] ?? null) : null;
  },
  action: c => {
    const match = /\b(?:created|updated|deleted|added|removed|configured)\b[^.]*\./iu.exec(c);
    return match ? (match[0] ?? null) : null;
  },
  query: c => {
    const match = /\b(?:search|find|query|lookup|retrieve)\b[^.]*\./iu.exec(c);
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

function groupByHeap(items: MemoryItem[]): Map<WriteHeap, MemoryItem[]> {
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
  return byHeap;
}

type SummarizeState = {
  longTermItems: MemoryItem[];
  discarded: MemoryItem[];
  usedTokens: number;
};

function handleBatchBudgetOverflow(
  batch: MemoryItem[],
  heap: WriteHeap,
  budgetRemaining: number,
  state: SummarizeState
): void {
  const sorted = [...batch].sort((a, b) => b.importance - a.importance);
  for (const item of sorted) {
    if (item.tokenCount <= budgetRemaining) {
      state.longTermItems.push({
        ...item,
        writeHeap: heap,
        metadata: { ...item.metadata, _summarized: false }
      });
      state.usedTokens += item.tokenCount;
      budgetRemaining -= item.tokenCount;
    } else {
      state.discarded.push(item);
    }
  }
}

function createSummaryItem(
  batch: MemoryItem[],
  heap: WriteHeap,
  summary: string,
  tokenCount: number,
  currentNow: number
): MemoryItem {
  const sourceIds = batch.map(i => i.id);
  const maxImportance = Math.max(...batch.map(i => i.importance));
  const firstBatchItem = batch[0];
  if (firstBatchItem === undefined) {
    throw new Error('Cannot summarize empty batch');
  }

  return {
    id: `ltm-summary-${heap}-${firstBatchItem.id}`,
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
    metadata: { sourceIds, _summarized: true }
  };
}

function processHeapGroup(
  heap: WriteHeap,
  group: MemoryItem[],
  budget: number,
  state: SummarizeState,
  currentNow: number,
  maxGroupSize: number
): void {
  for (let i = 0; i < group.length; i += maxGroupSize) {
    const batch = group.slice(i, i + maxGroupSize);
    const summary = summarizeGroup(batch, currentNow);
    const tokenCount = estimateTokens(summary);

    if (state.usedTokens + tokenCount > budget) {
      handleBatchBudgetOverflow(batch, heap, budget - state.usedTokens, state);
      continue;
    }

    state.longTermItems.push(createSummaryItem(batch, heap, summary, tokenCount, currentNow));
    state.usedTokens += tokenCount;
  }
}

export function createSummarizer(options: SummarizerOptions = {}): Summarizer {
  const now = options.now ?? (() => performance.now());
  const maxGroupSize = options.maxGroupSize ?? 10;

  return {
    summarize(items: MemoryItem[], budget: number): SummarizeResult {
      if (items.length === 0) {
        return {
          longTermItems: [],
          metaActions: [],
          discarded: [],
          tokenReduction: 0
        };
      }

      const currentNow = now();
      const metaActions = extractPatterns(items, currentNow);
      const byHeap = groupByHeap(items);

      const state: SummarizeState = {
        longTermItems: [],
        discarded: [],
        usedTokens: 0
      };
      const originalTokens = items.reduce((sum, item) => sum + item.tokenCount, 0);

      for (const [heap, group] of byHeap) {
        processHeapGroup(heap, group, budget, state, currentNow, maxGroupSize);
      }

      const tokenReduction = originalTokens === 0 ? 0 : (originalTokens - state.usedTokens) / originalTokens;

      return {
        longTermItems: state.longTermItems,
        metaActions,
        discarded: state.discarded,
        tokenReduction
      };
    }
  };
}
