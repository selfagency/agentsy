import { describe, expect, it } from 'vitest';

import { createVersionTracker } from './version-tracker.js';

describe('VersionTracker', () => {
  it('bumps versions and tracks history', () => {
    const tracker = createVersionTracker();

    expect(tracker.current('page')).toBe(0);
    expect(tracker.bump('page')).toBe(1);
    expect(tracker.bump('page')).toBe(2);
    expect(tracker.current('page')).toBe(2);
    expect(tracker.history('page')).toStrictEqual([1, 2]);
  });
});
