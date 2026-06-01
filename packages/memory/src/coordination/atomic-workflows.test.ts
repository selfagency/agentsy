import { describe, expect, it } from 'vitest';

import { type AtomicWorkflowContext, createAtomicWorkflowCoordinator } from './atomic-workflows.js';

describe('AtomicWorkflowCoordinator', () => {
  it('executes steps in order and commits successfully', async () => {
    const events: string[] = [];
    const coordinator = createAtomicWorkflowCoordinator();

    const result = await coordinator.runWorkflow('wf-1', [
      {
        name: 'raw',
        // biome-ignore lint/suspicious/useAwait: callback matches Promise<void> interface
        run: async (_context: AtomicWorkflowContext) => {
          events.push('run:raw');
        }
      },
      {
        name: 'wiki',
        // biome-ignore lint/suspicious/useAwait: callback matches Promise<void> interface
        run: async (_context: AtomicWorkflowContext) => {
          events.push('run:wiki');
        }
      },
      {
        name: 'vector',
        // biome-ignore lint/suspicious/useAwait: callback matches Promise<void> interface
        run: async (_context: AtomicWorkflowContext) => {
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
        // biome-ignore lint/suspicious/useAwait: callback matches Promise<void> interface
        rollback: async (_context: AtomicWorkflowContext) => {
          events.push('rollback:raw');
        },
        // biome-ignore lint/suspicious/useAwait: callback matches Promise<void> interface
        run: async (_context: AtomicWorkflowContext) => {
          events.push('run:raw');
        }
      },
      {
        name: 'wiki',
        // biome-ignore lint/suspicious/useAwait: callback matches Promise<void> interface
        rollback: async (_context: AtomicWorkflowContext) => {
          events.push('rollback:wiki');
        },
        // biome-ignore lint/suspicious/useAwait: callback matches Promise<void> interface
        run: async (_context: AtomicWorkflowContext) => {
          events.push('run:wiki');
        }
      },
      {
        name: 'vector',
        // biome-ignore lint/suspicious/useAwait: callback matches Promise<void> interface
        rollback: async (_context: AtomicWorkflowContext) => {
          events.push('rollback:vector');
        },
        // biome-ignore lint/suspicious/useAwait: callback matches Promise<void> interface
        run: async (_context: AtomicWorkflowContext) => {
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
