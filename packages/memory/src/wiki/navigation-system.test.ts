import { describe, expect, it } from 'vitest';

import { createNavigationSystem } from './navigation-system.js';

describe('NavigationSystem', () => {
  it('tracks outgoing links and backlinks', () => {
    const nav = createNavigationSystem();

    nav.linkPages('a', 'b');
    nav.linkPages('c', 'b');

    expect(nav.getOutgoing('a')).toStrictEqual(['b']);
    expect(new Set(nav.getBacklinks('b'))).toStrictEqual(new Set(['a', 'c']));
  });
});
