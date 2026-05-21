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

function extractPolarity(content: string): number {
  const polarityPatterns = [/\b(?:like|love|enjoy|prefer)s?\b/giu, /\b(?:dislike|hate|avoid|not)s?\b/giu];
  for (let i = 0; i < polarityPatterns.length; i++) {
    // nosemgrep: numeric array index verified by loop bounds
    if (polarityPatterns[i]?.test(content)) return i + 1;
  }
  return 0;
}

function observationsOverlap(a: Observation, b: Observation): boolean {
  // Check if two observations contradict by similar content
  const aWords = new Set(a.content.toLowerCase().split(/\s+/u));
  const bWords = new Set(b.content.toLowerCase().split(/\s+/u));
  const intersection = [...aWords].filter(w => bWords.has(w));
  const union = new Set([...aWords, ...bWords]);
  const jaccard = intersection.length / Math.max(1, union.size);

  // If they share significant vocabulary but have different polarity (e.g., like/dislike)
  const aPolarity = extractPolarity(a.content);
  const bPolarity = extractPolarity(b.content);

  return jaccard > 0.3 && aPolarity !== bPolarity && aPolarity > 0 && bPolarity > 0;
}

function scoreObservation(obs: Observation, priority: ResolutionPriority): number {
  // nosemgrep: sourceMemoryId key is from controlled Observation type, has fallback
  // NOSONAR: type cast is required by strict TS for Record<WriteHeap, number> index
  const sourceWeight = priority.sourceWeights[obs.sourceMemoryId as WriteHeap] ?? 0.5;
  const _recencyScore = 1.0; // We don't have extractedAt age here; caller handles temporal
  const confidenceScore = obs.confidence;
  return sourceWeight * (1 - priority.recencyBias) + confidenceScore * priority.recencyBias;
}

function buildRepresentations(group: Observation[]): Representation[] {
  const representations: Representation[] = [];

  // Explicit view: what was directly stated
  const explicit = group[0];
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
  const firstId = group[0];
  representations.push({
    id: `rep-contra-${firstId?.id ?? 'unknown'}`,
    observationIds: group.map(o => o.id),
    view: 'contradiction',
    summary: contradictionSummary,
    confidence: Math.max(0.3, group.reduce((sum, o) => sum + o.confidence, 0) / group.length)
  });

  return representations;
}

function hasNewerWinner(sorted: Observation[], priority: ResolutionPriority): boolean {
  const newest = [...sorted].sort((a, b) => b.extractedAt - a.extractedAt)[0];
  const highestSource = sorted[0];
  return (
    newest !== undefined && highestSource !== undefined && newest.id !== highestSource.id && priority.recencyBias > 0.5
  );
}

function determineResolutionMethod(sorted: Observation[], priority: ResolutionPriority): Resolution['method'] {
  if (hasNewerWinner(sorted, priority)) {
    return 'temporal';
  }
  return 'source_priority';
}

function createResolution(group: Observation[], priority: ResolutionPriority, currentNow: number): Resolution | null {
  const sorted = [...group].sort((a, b) => scoreObservation(b, priority) - scoreObservation(a, priority));
  const winner = sorted[0];
  if (!winner) return null;

  const representations = buildRepresentations(sorted);
  const method = determineResolutionMethod(sorted, priority);
  const resolutionConfidence = winner.confidence * (1 - (group.length - 1) * 0.1);

  return {
    id: `res-${winner.id}`,
    contradictionIds: group.map(o => o.id),
    representations,
    resolvedSummary: winner.content,
    resolutionConfidence: Math.max(0, resolutionConfidence),
    method,
    timestamp: currentNow
  };
}

function detectContradictionsInternal(observations: Observation[]): Observation[][] {
  const groups: Observation[][] = [];
  const visited = new Set<number>();

  for (let i = 0; i < observations.length; i++) {
    if (visited.has(i)) continue;
    const obsI = observations[i];
    if (!obsI) continue;
    const group: Observation[] = [obsI];
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
}

export function createDialecticResolver(options: DialecticResolverOptions = {}): DialecticResolver {
  const now = options.now ?? (() => performance.now());

  return {
    detectContradictions: detectContradictionsInternal,

    resolve(contradictions: Observation[][], priorityRules?: ResolutionPriority): Resolution[] {
      const priority = priorityRules ?? DEFAULT_PRIORITY;
      const currentNow = now();
      const resolutions: Resolution[] = [];

      for (const group of contradictions) {
        if (group.length < 2) continue;
        const resolution = createResolution(group, priority, currentNow);
        if (resolution) resolutions.push(resolution);
      }

      return resolutions;
    }
  };
}
