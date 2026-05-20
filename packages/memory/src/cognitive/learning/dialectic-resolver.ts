import type { WriteHeap } from '../tier-types.js';
import type { Observation } from './observation-extractor.js';

export type RepresentationView = 'explicit' | 'deductive' | 'inductive' | 'contradiction';

export interface Representation {
  id: string;
  observationIds: string[];
  view: RepresentationView;
  summary: string;
  confidence: number;
}

export interface Resolution {
  id: string;
  contradictionIds: string[];
  representations: Representation[];
  resolvedSummary: string;
  resolutionConfidence: number;
  method: 'deductive' | 'inductive' | 'temporal' | 'source_priority';
  timestamp: number;
}

export interface ResolutionPriority {
  sourceWeights: Partial<Record<WriteHeap, number>>;
  recencyBias: number;
  confidenceThreshold: number;
}

export interface DialecticResolver {
  detectContradictions(observations: Observation[]): Observation[][];
  resolve(contradictions: Observation[][], priorityRules?: ResolutionPriority): Resolution[];
}

export interface DialecticResolverOptions {
  now?: (() => number) | undefined;
}

const DEFAULT_PRIORITY: ResolutionPriority = {
  sourceWeights: { event: 0.8, doc: 0.6, query: 0.4, ref: 0.3 },
  recencyBias: 0.5,
  confidenceThreshold: 0.3
};

function observationsOverlap(a: Observation, b: Observation): boolean {
  // Check if two observations contradict by similar content
  const aWords = new Set(a.content.toLowerCase().split(/\s+/u));
  const bWords = new Set(b.content.toLowerCase().split(/\s+/u));
  const intersection = [...aWords].filter(w => bWords.has(w));
  const union = new Set([...aWords, ...bWords]);
  const jaccard = intersection.length / Math.max(1, union.size);

  // If they share significant vocabulary but have different polarity (e.g., like/dislike)
  const polarityPatterns = [/\b(?:like|love|enjoy|prefer)s?\b/giu, /\b(?:dislike|hate|avoid|not)s?\b/giu];
  let aPolarity = 0;
  let bPolarity = 0;
  for (let i = 0; i < polarityPatterns.length; i++) {
    if (polarityPatterns[i]?.test(a.content)) aPolarity = i + 1;
    if (polarityPatterns[i]?.test(b.content)) bPolarity = i + 1;
  }

  return jaccard > 0.3 && aPolarity !== bPolarity && aPolarity > 0 && bPolarity > 0;
}

function scoreObservation(obs: Observation, priority: ResolutionPriority): number {
  const sourceWeight = priority.sourceWeights[obs.sourceMemoryId as WriteHeap] ?? 0.5;
  const _recencyScore = 1.0; // We don't have extractedAt age here; caller handles temporal
  const confidenceScore = obs.confidence;
  return sourceWeight * (1 - priority.recencyBias) + confidenceScore * priority.recencyBias;
}

export function createDialecticResolver(options: DialecticResolverOptions = {}): DialecticResolver {
  const now = options.now ?? (() => performance.now());

  return {
    detectContradictions(observations: Observation[]): Observation[][] {
      const groups: Observation[][] = [];
      const visited = new Set<number>();

      for (let i = 0; i < observations.length; i++) {
        if (visited.has(i)) continue;
        const group: Observation[] = [observations[i] as Observation];
        visited.add(i);

        for (let j = i + 1; j < observations.length; j++) {
          if (visited.has(j)) continue;
          const a = observations[i];
          const b = observations[j];
          if (!a || !b) continue;
          if (observationsOverlap(a, b)) {
            group.push(b);
            visited.add(j);
          }
        }

        if (group.length >= 2) {
          groups.push(group);
        }
      }

      return groups;
    },

    resolve(contradictions: Observation[][], priorityRules?: ResolutionPriority): Resolution[] {
      const priority = priorityRules ?? DEFAULT_PRIORITY;
      const currentNow = now();
      const resolutions: Resolution[] = [];

      for (const group of contradictions) {
        if (group.length < 2) continue;

        // Sort by score (higher = more trustworthy)
        const sorted = [...group].sort((a, b) => scoreObservation(b, priority) - scoreObservation(a, priority));

        // Build representations for each view
        const representations: Representation[] = [];

        // Explicit view: what was directly stated
        const explicit = sorted[0];
        if (explicit) {
          representations.push({
            id: `rep-explicit-${explicit.id}`,
            observationIds: [explicit.id],
            view: 'explicit',
            summary: explicit.content,
            confidence: explicit.confidence
          });
        }

        // Contradiction view: summarize the conflict
        const contradictionSummary = group.map(o => o.content).join(' vs ');
        representations.push({
          id: `rep-contra-${group[0]?.id ?? 'unknown'}`,
          observationIds: group.map(o => o.id),
          view: 'contradiction',
          summary: contradictionSummary,
          confidence: Math.max(0.3, group.reduce((sum, o) => sum + o.confidence, 0) / group.length)
        });

        // Determine resolution method
        let method: Resolution['method'] = 'source_priority';
        const newest = [...sorted].sort((a, b) => b.extractedAt - a.extractedAt)[0];
        const highestSource = sorted[0];
        if (newest && highestSource && newest.id !== highestSource.id && priority.recencyBias > 0.5) {
          method = 'temporal';
        }

        // Use highest-scored observation as resolved summary
        const winner = sorted[0];
        if (!winner) continue;

        const resolutionConfidence = winner.confidence * (1 - (group.length - 1) * 0.1);

        resolutions.push({
          id: `res-${winner.id}`,
          contradictionIds: group.map(o => o.id),
          representations,
          resolvedSummary: winner.content,
          resolutionConfidence: Math.max(0, resolutionConfidence),
          method,
          timestamp: currentNow
        });
      }

      return resolutions;
    }
  };
}
