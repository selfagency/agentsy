import type { TierName } from '../tier-types.js';
import type { MergedConsolidation } from './consolidation-specialist.js';

export interface SolidificationCandidate {
  consolidation: MergedConsolidation;
  currentImportance: number;
  accessCount: number;
  ageMs: number;
  existingInLTM: boolean;
}

export interface SolidificationResult {
  id: string;
  candidateId: string;
  action: 'promote' | 'demote' | 'merge' | 'archive';
  targetTier: TierName;
  confidence: number;
  reason: string;
}

export interface Solidifier {
  evaluate(candidate: SolidificationCandidate): SolidificationResult;
  evaluateBatch(candidates: SolidificationCandidate[]): SolidificationResult[];
}

export interface SolidifierOptions {
  promotionThreshold?: number;
  demotionThreshold?: number;
  mergeSimilarityThreshold?: number;
  archiveAccessThreshold?: number;
  maxAgeBeforeArchive?: number;
  minAgeForDemotion?: number;
  now?: (() => number) | undefined;
}

export const DEFAULT_SOLIDIFIER_OPTIONS: Required<Omit<SolidifierOptions, 'now'>> = {
  promotionThreshold: 0.75,
  demotionThreshold: 0.3,
  mergeSimilarityThreshold: 0.85,
  archiveAccessThreshold: 2,
  maxAgeBeforeArchive: 30 * 24 * 60 * 60 * 1_000,
  minAgeForDemotion: 7 * 24 * 60 * 60 * 1_000
};

function _estimateSimilarity(a: string, b: string): number {
  const aWords = new Set(a.toLowerCase().split(/\s+/u));
  const bWords = new Set(b.toLowerCase().split(/\s+/u));
  const intersection = [...aWords].filter(w => bWords.has(w));
  const union = new Set([...aWords, ...bWords]);
  return intersection.length / Math.max(1, union.size);
}

export function createSolidifier(options: SolidifierOptions = {}): Solidifier {
  const opts = { ...DEFAULT_SOLIDIFIER_OPTIONS, ...options };
  const now = options.now ?? (() => performance.now());

  function evaluateSingle(candidate: SolidificationCandidate): SolidificationResult {
    const { consolidation } = candidate;
    const conf = consolidation.finalConfidence;
    const id = `solid-${consolidation.id}-${now()}`;

    // promote when high confidence and not already in LTM
    if (conf >= opts.promotionThreshold && !candidate.existingInLTM) {
      return {
        id,
        candidateId: consolidation.id,
        action: 'promote',
        targetTier: 'long_term_memory',
        confidence: conf,
        reason: `Consolidation confidence ${conf.toFixed(2)} meets promotion threshold ${opts.promotionThreshold}`
      };
    }

    // merge when existing in LTM and similar
    if (candidate.existingInLTM && conf >= opts.mergeSimilarityThreshold) {
      return {
        id,
        candidateId: consolidation.id,
        action: 'merge',
        targetTier: 'long_term_memory',
        confidence: conf,
        reason: `Existing LTM entry compatible; confidence ${conf.toFixed(2)} >= merge threshold ${opts.mergeSimilarityThreshold}`
      };
    }

    // demote when low confidence and old enough
    if (conf < opts.demotionThreshold && candidate.ageMs >= opts.minAgeForDemotion) {
      return {
        id,
        candidateId: consolidation.id,
        action: 'demote',
        targetTier: 'short_term_memory',
        confidence: conf,
        reason: `Confidence ${conf.toFixed(2)} below demotion threshold ${opts.demotionThreshold} and age ${Math.round(candidate.ageMs / 1_000 / 60 / 60)}h exceeds minimum`
      };
    }

    // archive when rarely accessed and very old
    if (candidate.accessCount < opts.archiveAccessThreshold && candidate.ageMs >= opts.maxAgeBeforeArchive) {
      return {
        id,
        candidateId: consolidation.id,
        action: 'archive',
        targetTier: 'long_term_memory',
        confidence: conf,
        reason: `Access count ${candidate.accessCount} below threshold ${opts.archiveAccessThreshold} and age ${Math.round(candidate.ageMs / 1_000 / 60 / 60)}h exceeds max`
      };
    }

    // Default: keep (but we don't have a 'keep' action, so archive if nothing else fits
    return {
      id,
      candidateId: consolidation.id,
      action: 'archive',
      targetTier: 'long_term_memory',
      confidence: conf,
      reason: `No promotion criteria met; archiving for review`
    };
  }

  return {
    evaluate(candidate: SolidificationCandidate): SolidificationResult {
      return evaluateSingle(candidate);
    },

    evaluateBatch(candidates: SolidificationCandidate[]): SolidificationResult[] {
      return candidates.map(c => evaluateSingle(c));
    }
  };
}
