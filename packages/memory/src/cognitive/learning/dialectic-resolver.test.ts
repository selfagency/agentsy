import { describe, expect, it } from 'vitest';

import { createDialecticResolver } from './dialectic-resolver.js';
import type { Observation } from './observation-extractor.js';

function makeObs(id: string, content: string, confidence = 0.7, kind: Observation['kind'] = 'factual'): Observation {
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

describe('DialecticResolver', () => {
  const resolver = createDialecticResolver();

  it('returns empty contradictions for non-contradictory observations', () => {
    const obs = [makeObs('1', 'The sky is blue'), makeObs('2', 'Grass is green')];
    const contradictions = resolver.detectContradictions(obs);
    expect(contradictions.length).toBe(0);
  });

  it('detects contradictions between opposite sentiments', () => {
    const obs = [makeObs('1', 'User likes dark mode'), makeObs('2', 'User dislikes dark mode')];
    const contradictions = resolver.detectContradictions(obs);
    expect(contradictions.length).toBeGreaterThanOrEqual(1);
  });

  it('returns empty resolutions for empty contradictions', () => {
    const resolutions = resolver.resolve([]);
    expect(resolutions.length).toBe(0);
  });

  it('resolves contradictions with source priority', () => {
    const obs = [makeObs('1', 'User likes dark mode', 0.8), makeObs('2', 'User dislikes dark mode', 0.5)];
    const contradictions = resolver.detectContradictions(obs);
    const resolutions = resolver.resolve(contradictions);
    expect(resolutions.length).toBeGreaterThanOrEqual(1);
    expect(resolutions[0]?.resolvedSummary).toBeDefined();
  });

  it('includes representations in resolutions', () => {
    const obs = [makeObs('1', 'User likes dark mode'), makeObs('2', 'User dislikes dark mode')];
    const contradictions = resolver.detectContradictions(obs);
    const resolutions = resolver.resolve(contradictions);
    expect(resolutions.length).toBeGreaterThanOrEqual(1);
    expect(resolutions[0]?.representations.length ?? 0).toBeGreaterThanOrEqual(1);
  });

  it('includes contradiction IDs in resolution', () => {
    const obs = [makeObs('1', 'User likes dark mode'), makeObs('2', 'User dislikes dark mode')];
    const contradictions = resolver.detectContradictions(obs);
    const resolutions = resolver.resolve(contradictions);
    expect(resolutions.length).toBeGreaterThanOrEqual(1);
    expect(resolutions[0]?.contradictionIds.length ?? 0).toBeGreaterThanOrEqual(2);
  });
});
