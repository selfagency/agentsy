import { describe, expect, it } from 'vitest';

import { createEntityExtractor } from './entity-extractor.js';

describe('EntityExtractor', () => {
  it('extracts entities with confidence and relationships', () => {
    const extractor = createEntityExtractor();

    const result = extractor.extract('OAuth works with OpenID Connect and PKCE. Redis caches tokens.');

    expect(result.entities.some(entity => entity.name === 'OAuth')).toBeTruthy();
    expect(result.entities.every(entity => entity.confidence >= 0 && entity.confidence <= 1)).toBeTruthy();
    expect(result.relationships.length).toBeGreaterThan(0);
  });
});
