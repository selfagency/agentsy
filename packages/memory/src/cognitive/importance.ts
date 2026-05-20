import type { MemoryItem } from './tier-types.js';

export interface ImportanceFactors {
  recencyWeight: number;
  frequencyWeight: number;
  sourceReliability: number;
  contentTypeWeight: number;
  relationalBoost: number;
}

export const DEFAULT_IMPORTANCE_FACTORS: ImportanceFactors = {
  recencyWeight: 0.3,
  frequencyWeight: 0.2,
  sourceReliability: 0.5,
  contentTypeWeight: 0.5,
  relationalBoost: 0
};

const CONTENT_TYPE_WEIGHTS: Record<string, number> = {
  event: 0.7,
  action: 0.8,
  observation: 0.5,
  query: 0.4,
  doc: 0.9,
  ref: 0.3
};

export function computeImportance(item: MemoryItem, factors: ImportanceFactors, now?: number): number {
  const currentNow = now ?? performance.now();
  const ageMs = Math.max(0, currentNow - item.createdAt);

  // Recency: 1.0 at creation, decays to 0 over time
  const recencyScore = 1 / (1 + ageMs / 30_000);

  // Frequency: based on access count
  const frequencyScore = Math.min(1, item.accessCount / 10);

  // Content type: based on writeHeap
  const contentTypeScore = CONTENT_TYPE_WEIGHTS[item.writeHeap] ?? factors.contentTypeWeight;

  // Weighted sum
  const total =
    recencyScore * factors.recencyWeight +
    frequencyScore * factors.frequencyWeight +
    factors.sourceReliability * 0.2 +
    contentTypeScore * factors.contentTypeWeight +
    factors.relationalBoost * 0.1;

  // Clamp to [0, 1]
  return Math.min(1, Math.max(0, total));
}

export function computeImportanceForItems(
  items: readonly MemoryItem[],
  factors: ImportanceFactors = DEFAULT_IMPORTANCE_FACTORS,
  now?: number
): Map<string, number> {
  const scores = new Map<string, number>();
  for (const item of items) {
    scores.set(item.id, computeImportance(item, factors, now));
  }
  return scores;
}
