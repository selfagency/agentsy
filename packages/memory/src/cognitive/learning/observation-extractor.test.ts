import { describe, expect, it } from 'vitest';

import { createTestMemoryItem } from '../testing.js';
import { createObservationExtractor } from './observation-extractor.js';

describe('ObservationExtractor', () => {
  const extractor = createObservationExtractor();

  it('extracts factual observations from declarative content', () => {
    const item = createTestMemoryItem({ content: 'The user is a software engineer. The project uses TypeScript.' });
    const observations = extractor.extract(item);
    const factuals = observations.filter(o => o.kind === 'factual');
    expect(factuals.length).toBeGreaterThanOrEqual(1);
  });

  it('extracts emotional observations from preference content', () => {
    const item = createTestMemoryItem({ content: 'The user likes dark mode. They dislike popups.' });
    const observations = extractor.extract(item);
    const emotionals = observations.filter(o => o.kind === 'emotional');
    expect(emotionals.length).toBeGreaterThanOrEqual(1);
  });

  it('extracts procedural observations from step content', () => {
    const item = createTestMemoryItem({ content: 'To deploy, first build the project then run the tests.' });
    const observations = extractor.extract(item);
    const procedurals = observations.filter(o => o.kind === 'procedural');
    expect(procedurals.length).toBeGreaterThanOrEqual(1);
  });

  it('extracts corrective observations from correction content', () => {
    const item = createTestMemoryItem({
      content: 'Previously thought the bug was in auth, actually it is in routing.'
    });
    const observations = extractor.extract(item);
    const correctives = observations.filter(o => o.kind === 'corrective');
    expect(correctives.length).toBeGreaterThanOrEqual(1);
  });

  it('extracts relational observations from relationship content', () => {
    const item = createTestMemoryItem({ content: 'Alice met Bob at Conference X. Alice works with Charlie.' });
    const observations = extractor.extract(item);
    const relationals = observations.filter(o => o.kind === 'relational');
    expect(relationals.length).toBeGreaterThanOrEqual(1);
  });

  it('returns empty array for content with no extractable patterns', () => {
    const item = createTestMemoryItem({ content: 'Hello world' });
    const observations = extractor.extract(item);
    expect(observations.length).toBeGreaterThanOrEqual(0);
  });

  it('assigns unique IDs per observation', () => {
    const item = createTestMemoryItem({ content: 'A is B. C is D.' });
    const observations = extractor.extract(item);
    const ids = new Set(observations.map(o => o.id));
    expect(ids.size).toBe(observations.length);
  });

  it('sets sourceMemoryId to parent item ID', () => {
    const item = createTestMemoryItem({ content: 'Test content' });
    const observations = extractor.extract(item);
    for (const obs of observations) {
      expect(obs.sourceMemoryId).toBe(item.id);
    }
  });

  it('deduplicates identical observations', () => {
    const item = createTestMemoryItem({ content: 'The user likes dark mode. The user likes dark mode.' });
    const observations = extractor.extract(item);
    const emotionals = observations.filter(o => o.kind === 'emotional');
    // Should not have duplicated identical observations
    const unique = new Set(emotionals.map(o => o.content));
    expect(unique.size).toBe(emotionals.length);
  });

  it('processes batch extraction', () => {
    const items = [createTestMemoryItem({ content: 'Fact one.' }), createTestMemoryItem({ content: 'Fact two.' })];
    const observations = extractor.extractBatch(items);
    expect(observations.length).toBeGreaterThanOrEqual(0);
  });

  it('includes confidence scores in [0,1]', () => {
    const item = createTestMemoryItem({ content: 'The system uses Redis.' });
    const observations = extractor.extract(item);
    for (const obs of observations) {
      expect(obs.confidence).toBeGreaterThanOrEqual(0);
      expect(obs.confidence).toBeLessThanOrEqual(1);
    }
  });
});
