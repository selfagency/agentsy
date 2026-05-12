import { describe, expect, it } from 'vitest';

import { AgentRegistry } from '../agents/registry.js';
import type { AgentCapabilities, WorkflowSpec } from '../types/index.js';
import { NodeType, WorkflowStatus } from '../types/index.js';
import { OrchestrationEngine, type TaskScheduler } from './engine.js';

function createAgent(overrides: Partial<AgentCapabilities> = {}): AgentCapabilities {
  return {
    id: overrides.id ?? 'agent-1',
    name: overrides.name ?? 'Agent 1',
    skills: overrides.skills ?? [
      {
        id: 'skill-1',
        name: 'general',
        category: 'general',
        proficiency: 'advanced',
        capabilities: ['execute'],
      },
    ],
    maxConcurrency: overrides.maxConcurrency ?? 1,
    costPerTask: overrides.costPerTask ?? 0.1,
    available: overrides.available ?? true,
    lastSeen: overrides.lastSeen ?? new Date('2026-01-01T00:00:00.000Z'),
  };
}

function createBaseSpec(overrides: Partial<WorkflowSpec>): WorkflowSpec {
  return {
    id: overrides.id ?? 'wf-1',
    name: overrides.name ?? 'Workflow 1',
    description: overrides.description ?? 'test workflow',
    version: overrides.version ?? '1.0.0',
    requirements: overrides.requirements ?? {
      skills: [],
      resources: [],
      constraints: [],
      dependencies: [],
    },
    nodes: overrides.nodes ?? [],
    events: overrides.events ?? {
      triggers: [],
      handlers: [],
      filters: [],
    },
    timing: overrides.timing ?? {
      timeout: 10_000,
      retries: 0,
      scheduling: 'immediate',
      priorities: {},
    },
  };
}

function createScheduler(agentId: string): TaskScheduler {
  return {
    async schedule<T>(task: (() => Promise<T>) | { taskInfo: unknown; agents: unknown[] }) {
      if (typeof task === 'function') {
        return task();
      }

      return {
        agentId,
        assigned: true as const,
        status: 'scheduled' as const,
      };
    },
  };
}

describe('OrchestrationEngine', () => {
  it('uses the engine registry/scheduler when execute options are not provided', async () => {
    const registry = new AgentRegistry();
    registry.register(createAgent({ id: 'agent-available' }));

    const scheduler = createScheduler('agent-available');

    const engine = new OrchestrationEngine(registry, scheduler);

    const workflow = await engine.create(
      createBaseSpec({
        nodes: [
          {
            type: NodeType.TASK,
            id: 'task-1',
            name: 'Task 1',
            agent: 'agent-available',
            input: {},
            output: {},
          },
        ],
      }),
    );

    const result = await engine.execute(workflow);

    expect(result.status).toBe(WorkflowStatus.COMPLETED);
    expect(result.results).toEqual({ result: 'Task task-1 executed by agent agent-available' });
  });

  it('creates workflows with the default scheduler when one is not provided', async () => {
    const registry = new AgentRegistry();
    registry.register(createAgent({ id: 'agent-default' }));

    const engine = new OrchestrationEngine(registry);

    const workflow = await engine.create(
      createBaseSpec({
        id: 'wf-default-scheduler',
        nodes: [
          {
            type: NodeType.TASK,
            id: 'task-default',
            name: 'Task default',
            agent: 'agent-default',
            input: {},
            output: {},
          },
        ],
      }),
    );

    const result = await engine.execute(workflow);

    expect(result.status).toBe(WorkflowStatus.COMPLETED);
    expect(result.results).toEqual({ result: 'Task task-default executed by agent agent-default' });
  });

  it('executes parallel and merge nodes inside a sequence', async () => {
    const registry = new AgentRegistry();
    registry.register(createAgent({ id: 'agent-seq' }));

    const scheduler = createScheduler('agent-seq');

    const engine = new OrchestrationEngine(registry, scheduler);

    const workflow = await engine.create(
      createBaseSpec({
        id: 'wf-sequence',
        nodes: [
          {
            type: NodeType.SEQUENCE,
            id: 'sequence-1',
            name: 'Sequence 1',
            steps: ['parallel-1', 'merge-1'],
          },
          {
            type: NodeType.PARALLEL,
            id: 'parallel-1',
            name: 'Parallel 1',
            branches: ['task-a', 'task-b'],
            failFast: true,
          },
          {
            type: NodeType.TASK,
            id: 'task-a',
            name: 'Task A',
            agent: 'agent-seq',
            input: {},
            output: {},
          },
          {
            type: NodeType.TASK,
            id: 'task-b',
            name: 'Task B',
            agent: 'agent-seq',
            input: {},
            output: {},
          },
          {
            type: NodeType.MERGE,
            id: 'merge-1',
            name: 'Merge 1',
            inputs: ['task-a', 'task-b'],
            strategy: 'all',
          },
        ],
      }),
    );

    const result = await engine.execute(workflow);
    const sequenceCandidate: unknown = result.results;

    expect(result.status).toBe(WorkflowStatus.COMPLETED);
    expect(Array.isArray(sequenceCandidate)).toBe(true);
    if (!Array.isArray(sequenceCandidate)) {
      throw new Error('Expected sequence result to be an array');
    }

    const sequenceResult = sequenceCandidate;
    expect(sequenceResult).toHaveLength(2);

    const mergeResult = sequenceResult[1] as Array<{ result: string }>;
    expect(mergeResult).toHaveLength(2);
    expect(mergeResult[0]?.result).toContain('task-a');
    expect(mergeResult[1]?.result).toContain('task-b');
  });

  it('executes decision nodes and follows the true branch', async () => {
    const registry = new AgentRegistry();
    registry.register(createAgent({ id: 'agent-decision' }));

    const scheduler = createScheduler('agent-decision');

    const engine = new OrchestrationEngine(registry, scheduler);

    const workflow = await engine.create(
      createBaseSpec({
        id: 'wf-decision',
        nodes: [
          {
            type: NodeType.DECISION,
            id: 'decision-1',
            name: 'Decision 1',
            condition: 'true',
            trueBranch: ['task-true'],
            falseBranch: ['task-false'],
          },
          {
            type: NodeType.TASK,
            id: 'task-true',
            name: 'Task True',
            agent: 'agent-decision',
            input: {},
            output: {},
          },
          {
            type: NodeType.TASK,
            id: 'task-false',
            name: 'Task False',
            agent: 'agent-decision',
            input: {},
            output: {},
          },
        ],
      }),
    );

    const result = await engine.execute(workflow);

    expect(result.status).toBe(WorkflowStatus.COMPLETED);
    expect(result.results).toEqual({
      decision: true,
      branch: 'true',
      results: [{ result: 'Task task-true executed by agent agent-decision' }],
    });
  });

  it('rejects workflows that reference unknown nodes', async () => {
    const registry = new AgentRegistry();
    const scheduler = createScheduler('unused');

    const engine = new OrchestrationEngine(registry, scheduler);

    await expect(
      engine.create(
        createBaseSpec({
          id: 'wf-invalid',
          nodes: [
            {
              type: NodeType.SEQUENCE,
              id: 'sequence-invalid',
              name: 'Invalid Sequence',
              steps: ['missing-node'],
            },
          ],
        }),
      ),
    ).rejects.toThrow('Sequence node sequence-invalid references unknown node: missing-node');
  });
});
