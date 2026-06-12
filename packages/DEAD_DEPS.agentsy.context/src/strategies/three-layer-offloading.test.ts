import { describe, expect, it } from 'vitest';

import { createThreeLayerOffloading } from './three-layer-offloading.js';

describe('three-layer offloading', () => {
  it('routes input, messages, and result independently', () => {
    const offload = createThreeLayerOffloading('diff --git a/a b/a', [{ content: '{"x":1}' }], 'plain prose');

    expect(offload.inputLayer.kind).toBe('diff');
    expect(offload.messageLayer.kind).toBe('json');
    expect(offload.resultLayer.kind).toBe('prose');
  });
});
