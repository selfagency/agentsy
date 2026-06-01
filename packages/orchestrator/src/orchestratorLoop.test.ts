import { describe, expect, it } from 'vitest';
import { isStepCount } from './agent/index.js';
import { createOrchestratorLoop } from './orchestratorLoop.js';

describe('createOrchestratorLoop', () => {
  it('exposes scheduler operations alongside the agent loop handle', async () => {
    const loop = createOrchestratorLoop({
      execute: async function* () {
        yield { content: 'done', done: true, finishReason: 'stop' as const };
      },
      stopWhen: isStepCount(1),
      buildToolResultMessages: async () => []
    });

    const scheduled = loop.scheduleTask({ id: 'task-1', prompt: 'run later', lane: 'nightly' });

    expect(scheduled.status).toBe('pending');
    expect(loop.getScheduledTask('task-1')?.prompt).toBe('run later');
    expect(loop.listScheduledTasks({ lane: 'nightly' })).toHaveLength(1);
    expect(loop.cancelScheduledTask('task-1')?.status).toBe('cancelled');

    const parts = [];
    for await (const part of loop.run([])) {
      parts.push(part);
    }

    expect(parts.length).toBeGreaterThan(0);
  });
});
