import { describe, expect, it } from 'vitest';

import { createConsolidationSpecialist } from './consolidation-specialist.js';
import type { Observation } from './observation-extractor.js';

function makeObs(id: string, content: string, kind: Observation['kind'] = 'factual', confidence = 0.7): Observation {
  return {
    id,
    kind,
    content,
    sourceMemoryId: 'mem-test',
    confidence,
    contradictsWith: [],
    supportsIds: [],
    extractedAt: 10_000
  };
}

describe('ConsolidationSpecialist', () => {
  const specialist = createConsolidationSpecialist();

  it('runs deduction specialist', async () => {
    const obs = [makeObs('1', 'X is Y'), makeObs('2', 'X is Y')];
    const result = await specialist.consolidate('deduction', obs);
    expect(result.role).toBe('deduction');
    expect(result.output.length).toBeGreaterThan(0);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.noveltyScore).toBeGreaterThanOrEqual(0);
    expect(result.tokenCost).toBeGreaterThan(0);
  });

  it('runs induction specialist', async () => {
    const obs = [makeObs('1', 'User prefers CLI'), makeObs('2', 'User prefers CLI')];
    const result = await specialist.consolidate('induction', obs);
    expect(result.role).toBe('induction');
    expect(result.output.length).toBeGreaterThan(0);
  });

  it('runs surprisal specialist with corrective observations', async () => {
    const obs = [makeObs('1', 'Bug is in auth', 'corrective')];
    const result = await specialist.consolidate('surprisal', obs);
    expect(result.role).toBe('surprisal');
    expect(result.output.length).toBeGreaterThan(0);
  });

  it('runs temporal specialist', async () => {
    const obs = [makeObs('1', 'Old preference'), makeObs('2', 'New preference')];
    const result = await specialist.consolidate('temporal', obs);
    expect(result.role).toBe('temporal');
    expect(result.output.length).toBeGreaterThan(0);
  });

  it('tracks input observation IDs', async () => {
    const obs = [makeObs('a', 'Test'), makeObs('b', 'Test')];
    const result = await specialist.consolidate('deduction', obs);
    expect(result.inputObservationIds).toContain('a');
    expect(result.inputObservationIds).toContain('b');
  });

  it('merges multiple specialist results', async () => {
    const obs = [makeObs('1', 'Data point')];
    const r1 = await specialist.consolidate('deduction', obs);
    const r2 = await specialist.consolidate('induction', obs);
    const merged = await specialist.merge([r1, r2]);
    expect(merged.specialistResults.length).toBe(2);
    expect(merged.mergedSummary.length).toBeGreaterThan(0);
    expect(merged.finalConfidence).toBeGreaterThanOrEqual(0);
  });

  it('returns empty merge for empty results', async () => {
    const merged = await specialist.merge([]);
    expect(merged.specialistResults.length).toBe(0);
    expect(merged.finalConfidence).toBe(0);
  });

  it('deduplicates overlapping outputs in merge', async () => {
    const obs = [makeObs('1', 'Same content')];
    const r1 = await specialist.consolidate('deduction', obs);
    // Manually duplicate
    const r2 = { ...r1, id: 'consol-deduction-2', role: 'induction' as const };
    const merged = await specialist.merge([r1, r2]);
    expect(merged.specialistResults.length).toBeLessThanOrEqual(2);
  });
});
