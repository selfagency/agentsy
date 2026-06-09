import { describe, expect, it, vi } from 'vitest';

import { emitHelperComplete, emitHelperFailure, emitHelperStart } from './helper-lifecycle.js';

describe('helper lifecycle events', () => {
  it('emits start, complete, and failure', () => {
    const onStart = vi.fn();
    const onComplete = vi.fn();
    const onFailure = vi.fn();

    emitHelperStart({ onStart }, { helperId: 'planner', input: {}, sessionId: 's1' });
    emitHelperComplete({ onComplete }, { helperId: 'planner', output: {}, sessionId: 's1' });
    emitHelperFailure({ onFailure }, new Error('boom'), { helperId: 'planner', input: {}, sessionId: 's1' });

    expect(onStart).toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalled();
    expect(onFailure).toHaveBeenCalled();
  });
});
