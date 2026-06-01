import { describe, expect, it } from 'vitest';

import { createLocalEmbeddingEngine } from './local-embedding-engine.js';

describe('LocalEmbeddingEngine', () => {
  it('returns stable vector dimensions and non-empty magnitude for non-empty text', () => {
    const engine = createLocalEmbeddingEngine({ dimensions: 16 });
    const vector = engine.embed('oauth pkce refresh token');

    expect(vector).toHaveLength(16);
    expect(vector.some(value => value > 0)).toBeTruthy();
  });
});
