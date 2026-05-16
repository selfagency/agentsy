import { describe, expect, it } from 'vitest';

import { createRAGConfig } from './config.js';

describe(createRAGConfig, () => {
  it('defaults to local-only retrieval and disabled web augmentation', () => {
    const config = createRAGConfig({});

    expect(config.localOnly).toBeTruthy();
    expect(config.web.enabled).toBeFalsy();
    expect(config.weights.vector).toBeGreaterThan(0);
    expect(config.weights.lexical).toBeGreaterThan(0);
    expect(config.weights.temporal).toBeGreaterThan(0);
    expect(config.weights.entity).toBeGreaterThan(0);
  });

  it('applies explicit overrides with normalized weights', () => {
    const config = createRAGConfig({
      localOnly: false,
      web: {
        allowHosts: ['docs.example.com'],
        enabled: true
      },
      weights: {
        entity: 1,
        lexical: 2,
        temporal: 1,
        vector: 2
      }
    });

    expect(config.localOnly).toBeFalsy();
    expect(config.web.enabled).toBeTruthy();
    expect(
      config.weights.vector + config.weights.lexical + config.weights.temporal + config.weights.entity
    ).toBeCloseTo(1, 3);
  });
});
