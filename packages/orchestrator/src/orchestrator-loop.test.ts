import { describe, expect, it } from 'vitest';

import { createOrchestratorLoop } from './orchestrator-loop.js';

describe('createOrchestratorLoop', () => {
  it('exposes helper roles and scheduled task helpers', () => {
    const loop = createOrchestratorLoop({
      buildToolResultMessages: async () => [],
      async *execute() {
        // No-op — immediate completion
      },
      stopWhen: () => true
    });

    expect(loop.listHelperRoles().length).toBeGreaterThan(0);
    expect(loop.getHelperRole('planner')).toBeDefined();
  });
});
