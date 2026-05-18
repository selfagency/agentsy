import { describe, expect, it } from 'vitest';

import { createAtomicWorkflowCoordinator } from './atomic-workflows.js';

describe('AtomicWorkflowCoordinator', () => {
  it('executes steps in order and commits successfully', async () => {
    const events: string[] = [];
    const coordinator = createAtomicWorkflowCoordinator();

    const result = await coordinator.runWorkflow('wf-1', [
      {
        name: 'raw',
        run: async (): Promise<void> => {
          events.push('run:raw');
        }
      },
      {
        name: 'wiki',
        run: async (): Promise<void> => {
          events.push('run:wiki');
        }
      },
      {
        name: 'vector',
        run: async (): Promise<void> => {
          events.push('run:vector');
        }
      }
    ]);

    expect(events).toStrictEqual(['run:raw', 'run:wiki', 'run:vector']);
    expect(result.status).toBe('committed');
    expect(result.executedSteps).toStrictEqual(['raw', 'wiki', 'vector']);
    expect(result.rolledBackSteps).toStrictEqual([]);
  });

  it('rolls back already executed steps in reverse order when a step fails', async () => {
    const events: string[] = [];
    const coordinator = createAtomicWorkflowCoordinator();

    const result = await coordinator.runWorkflow('wf-rollback', [
      {
        name: 'raw',
        rollback: async (): Promise<void> => {
          events.push('rollback:raw');
        },
        run: async (): Promise<void> => {
          events.push('run:raw');
        }
      },
      {
        name: 'wiki',
        rollback: async (): Promise<void> => {
          events.push('rollback:wiki');
        },
        run: async (): Promise<void> => {
          events.push('run:wiki');
        }
      },
      {
        name: 'vector',
        rollback: async (): Promise<void> => {
          events.push('rollback:vector');
        },
        run: async (): Promise<void> => {
          events.push('run:vector');
          throw new Error('Step failed');
        }
      }
    ]);

    expect(result.status).toBe('rolled_back');
    expect(result.executedSteps).toStrictEqual(['raw', 'wiki']);
    expect(result.rolledBackSteps).toStrictEqual(['wiki', 'raw']);
    expect(events).toStrictEqual(['run:raw', 'run:wiki', 'run:vector', 'rollback:wiki', 'rollback:raw']);
    expect(result.error?.message).toBe('Step failed');
  });
});
