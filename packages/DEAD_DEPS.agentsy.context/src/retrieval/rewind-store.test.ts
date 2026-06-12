import { describe, expect, it } from 'vitest';

import { createRewindStore } from './rewind-store.js';

describe('rewind store', () => {
  it('stores and resolves reversible records by marker id', () => {
    const store = createRewindStore();

    store.put({
      markers: [{ id: 'marker_1', kind: 'url', source: 'https://example.com' }],
      original: 'https://example.com'
    });

    expect(store.resolve('marker_1')).toBe('https://example.com');
    expect(store.get('marker_1')?.markers[0]?.kind).toBe('url');
  });
});
