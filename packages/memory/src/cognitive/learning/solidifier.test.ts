import { describe, expect, it } from 'vitest';

import type { MergedConsolidation } from './consolidation-specialist.js';
import { createSolidifier, DEFAULT_SOLIDIFIER_OPTIONS } from './solidifier.js';

describe('Solidifier', () => {
  const solidifier = createSolidifier();

  function makeConsolidation(finalConfidence: number): MergedConsolidation {
    return {
      id: `consol-${finalConfidence}`,
      specialistResults: [],
      mergedSummary: 'Test summary',
      finalConfidence,
      sourceObservationIds: ['obs-1']
    };
  }

  function makeCandidate(
    consolidation: MergedConsolidation,
    opts: Partial<{
      currentImportance: number;
      accessCount: number;
      ageMs: number;
      existingInLTM: boolean;
    }> = {}
  ) {
    return {
      consolidation,
      currentImportance: opts.currentImportance ?? consolidation.finalConfidence,
      accessCount: opts.accessCount ?? 5,
      ageMs: opts.ageMs ?? 0,
      existingInLTM: opts.existingInLTM ?? false
    };
  }

  it('promotes high-confidence new consolidations', () => {
    const candidate = makeCandidate(makeConsolidation(0.9));
    const result = solidifier.evaluate(candidate);
    expect(result.action).toBe('promote');
    expect(result.targetTier).toBe('long_term_memory');
  });

  it('merges existing LTM entries with sufficient confidence', () => {
    const candidate = makeCandidate(makeConsolidation(0.9), { existingInLTM: true });
    const result = solidifier.evaluate(candidate);
    expect(result.action).toBe('merge');
    expect(result.targetTier).toBe('long_term_memory');
  });

  it('demotes low-confidence old consolidations', () => {
    const candidate = makeCandidate(makeConsolidation(0.1), {
      ageMs: DEFAULT_SOLIDIFIER_OPTIONS.minAgeForDemotion + 1,
      accessCount: 0
    });
    const result = solidifier.evaluate(candidate);
    expect(result.action).toBe('demote');
    expect(result.targetTier).toBe('short_term_memory');
  });

  it('archives rarely accessed old items', () => {
    const candidate = makeCandidate(makeConsolidation(0.5), {
      accessCount: 0,
      ageMs: DEFAULT_SOLIDIFIER_OPTIONS.maxAgeBeforeArchive + 1
    });
    const result = solidifier.evaluate(candidate);
    expect(result.action).toBe('archive');
  });

  it('includes reason in result', () => {
    const candidate = makeCandidate(makeConsolidation(0.9));
    const result = solidifier.evaluate(candidate);
    expect(result.reason.length).toBeGreaterThan(0);
  });

  it('evaluates batch candidates', () => {
    const candidates = [
      makeCandidate(makeConsolidation(0.9)),
      makeCandidate(makeConsolidation(0.1), { ageMs: DEFAULT_SOLIDIFIER_OPTIONS.minAgeForDemotion + 1 })
    ];
    const results = solidifier.evaluateBatch(candidates);
    expect(results.length).toBe(2);
    expect(results[0]?.action).toBe('promote');
    expect(results[1]?.action).toBe('demote');
  });
});
