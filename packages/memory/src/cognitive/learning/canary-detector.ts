import type { MemoryItem } from '../tier-types.js';
import type { Observation } from './observation-extractor.js';

export interface CanaryCheck {
  accessFrequencyTrend: 'increasing' | 'stable' | 'decreasing';
  importanceDecay: number;
  lastAccessedAge: number;
  memoryId: string;
  recentContradictionCount: number;
}

export interface CanaryResult {
  action: 'keep' | 'refresh' | 'demote' | 'archive' | 'flag_for_review';
  memoryId: string;
  nextCheckMs: number;
  reason: string;
  status: 'healthy' | 'stale' | 'degraded' | 'contradicted';
}

export interface CanaryDetector {
  check(memory: MemoryItem, recentObservations: Observation[]): CanaryResult;
  checkBatch(memories: MemoryItem[], recentObservations: Observation[]): CanaryResult[];
}

export interface CanaryDetectorOptions {
  checkInterval?: number;
  degradationThreshold?: number;
  now?: (() => number) | undefined;
  staleThreshold?: number;
}

const DEFAULT_CANARY_OPTIONS: Required<Omit<CanaryDetectorOptions, 'now'>> = {
  staleThreshold: 7 * 24 * 60 * 60 * 1000,
  degradationThreshold: 0.4,
  checkInterval: 60 * 60 * 1000
};

function computeTrend(accessCount: number, ageMs: number): CanaryCheck['accessFrequencyTrend'] {
  if (ageMs === 0) {
    return 'stable';
  }
  const frequency = accessCount / (ageMs / 1000);
  if (frequency > 0.001) {
    return 'increasing';
  }
  if (frequency > 0.0001) {
    return 'stable';
  }
  return 'decreasing';
}

function countContradictions(memory: MemoryItem, observations: Observation[]): number {
  let count = 0;
  const memoryWords = new Set(memory.content.toLowerCase().split(/\s+/u));
  for (const obs of observations) {
    const obsWords = new Set(obs.content.toLowerCase().split(/\s+/u));
    const shared = [...memoryWords].filter(w => obsWords.has(w)).length;
    const total = new Set([...memoryWords, ...obsWords]).size;
    const similarity = shared / Math.max(1, total);
    // If they share vocabulary but have opposite sentiment, count as contradiction
    if (similarity > 0.3) {
      const hasOpposite =
        (/\b(?:like|love|enjoy)s?\b/iu.test(memory.content) && /\b(?:dislike|hate|avoid)s?\b/iu.test(obs.content)) ||
        (/\b(?:dislike|hate|avoid)s?\b/iu.test(memory.content) && /\b(?:like|love|enjoy)s?\b/iu.test(obs.content));
      if (hasOpposite) {
        count++;
      }
    }
  }
  return count;
}

export function createCanaryDetector(options: CanaryDetectorOptions = {}): CanaryDetector {
  const opts = { ...DEFAULT_CANARY_OPTIONS, ...options };
  const now = options.now ?? (() => performance.now());

  function checkSingle(memory: MemoryItem, recentObservations: Observation[]): CanaryResult {
    const currentNow = now();
    const lastAccessedAge = currentNow - memory.lastAccessedAt;
    const recentContradictionCount = countContradictions(memory, recentObservations);
    const originalImportance = memory.metadata?.originalImportance as number | undefined;
    const importanceDecay =
      typeof originalImportance === 'number' && originalImportance > 0
        ? (originalImportance - memory.importance) / originalImportance
        : 0;
    const accessFrequencyTrend = computeTrend(memory.accessCount, currentNow - memory.createdAt);

    let status: CanaryResult['status'];
    let action: CanaryResult['action'];
    let reason: string;

    if (recentContradictionCount > 0) {
      status = 'contradicted';
      action = 'flag_for_review';
      reason = `${recentContradictionCount} recent observations contradict this memory`;
    } else if (lastAccessedAge > opts.staleThreshold) {
      status = 'stale';
      action = 'refresh';
      reason = `Not accessed for ${Math.round(lastAccessedAge / 1000 / 60 / 60)}h (threshold: ${Math.round(opts.staleThreshold / 1000 / 60 / 60)}h)`;
    } else if (importanceDecay >= opts.degradationThreshold && accessFrequencyTrend === 'decreasing') {
      status = 'degraded';
      action = 'demote';
      reason = `Importance decayed ${(importanceDecay * 100).toFixed(0)}% with decreasing access frequency`;
    } else {
      status = 'healthy';
      action = 'keep';
      reason = 'Recently accessed, no contradictions, stable importance';
    }

    return {
      memoryId: memory.id,
      status,
      action,
      reason,
      nextCheckMs: currentNow + opts.checkInterval
    };
  }

  return {
    check(memory: MemoryItem, recentObservations: Observation[]): CanaryResult {
      return checkSingle(memory, recentObservations);
    },

    checkBatch(memories: MemoryItem[], recentObservations: Observation[]): CanaryResult[] {
      return memories.map(m => checkSingle(m, recentObservations));
    }
  };
}
