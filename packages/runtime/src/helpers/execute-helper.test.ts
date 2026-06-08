import { describe, expect, it, vi } from 'vitest';

import { executeRuntimeHelper } from './execute-helper.js';

describe('executeRuntimeHelper', () => {
  it('emits lifecycle events and returns output', async () => {
    const onStart = vi.fn();
    const onComplete = vi.fn();

    const result = await executeRuntimeHelper(
      { helperId: 'planner', input: { task: 'x' }, sessionId: 's1' },
      async invocation => ({ ok: invocation.input.task === 'x' }),
      undefined,
      { onComplete, onStart }
    );

    expect(result.output).toStrictEqual({ ok: true });
    expect(onStart).toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalled();
  });
});
