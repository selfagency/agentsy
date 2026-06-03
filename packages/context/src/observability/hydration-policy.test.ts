import { describe, expect, it } from 'vitest';

import { createHydrationPolicy } from './hydration-policy.js';

describe('hydration policy', () => {
  it('prioritizes retained anchors and recent edits', () => {
    const policy = createHydrationPolicy({
      recentEdits: [{ id: 'file-a', weight: 2 }],
      retainedAnchors: [{ id: 'anchor-a', importance: 0.9 }],
      sessionId: 'sess_1'
    });

    expect(policy.sessionId).toBe('sess_1');
    expect(policy.candidates.some(candidate => candidate.id === 'anchor-a')).toBe(true);
  });
});
