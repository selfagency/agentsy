import { describe, expect, it } from 'vitest';

import { AgentRegistry } from '../agents/registry.js';
import type { AgentCapabilities, WorkflowSpec } from '../types/index.js';
import { NodeType, WorkflowStatus } from '../types/index.js';
import type { TaskScheduler } from './engine.js';
import { OrchestrationEngine } from './engine.js';

function createAgent(overrides: Partial<AgentCapabilities> = {}): AgentCapabilities {
  return {
    available: overrides.available ?? true,
    costPerTask: overrides.costPerTask ?? 0.1,
    id: overrides.id ?? 'agent-1',
    lastSeen: overrides.lastSeen ?? new Date('2026-01-01T00:00:00.000Z'),
    maxConcurrency: overrides.maxConcurrency ?? 1,
    name: overrides.name ?? 'Agent 1',
    skills: overrides.skills ?? [
      {
        capabilities: ['execute'],
        category: 'general',
        id: 'skill-1',
        name: 'general',
        proficiency: 'advanced'
      }
    ]
  };
}

function createBaseSpec(overrides: Partial<WorkflowSpec>): WorkflowSpec {
  return {
    description: overrides.description ?? 'test workflow',
    events: overrides.events ?? {
      filters: [],
      handlers: [],
      triggers: []
    },
    id: overrides.id ?? 'wf-1',
    name: overrides.name ?? 'Workflow 1',
    nodes: overrides.nodes ?? [],
    requirements: overrides.requirements ?? {
      constraints: [],
      dependencies: [],
      resources: [],
      skills: []
    },
    timing: overrides.timing ?? {
      priorities: {},
      retries: 0,
      scheduling: 'immediate',
      timeout: 10_000
    },
    version: overrides.version ?? '1.0.0'
  };
}

function createScheduler(agentId: string): TaskScheduler {
  return {
    async schedule<T>(task: (() => Promise<T>) | { taskInfo: unknown; agents: unknown[] }) {
      if (typeof task === 'function') {
        return await task();
      }

      return {
        agentId,
        assigned: true as const,
        status: 'scheduled' as const
      };
    }
  };
}

describe(OrchestrationEngine, () => {
  it('uses the engine registry/scheduler when execute options are not provided', async () => {
    const registry = new AgentRegistry();
    registry.register(createAgent({ id: 'agent-available' }));

    const scheduler = createScheduler('agent-available');

    const engine = new OrchestrationEngine(registry, scheduler);

    const workflow = await engine.create(
      createBaseSpec({
        nodes: [
          {
            agent: 'agent-available',
            id: 'task-1',
            input: {},
            name: 'Task 1',
            output: {},
            type: NodeType.TASK
          }
        ]
      })
    );

    const result = await engine.execute(workflow);

    expect(result.status).toBe(WorkflowStatus.COMPLETED);
    expect(result.results).toStrictEqual({
      result: 'Task task-1 executed by agent agent-available'
    });
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
            agent: 'agent-default',
            id: 'task-default',
            input: {},
            name: 'Task default',
            output: {},
            type: NodeType.TASK
          }
        ]
      })
    );

    const result = await engine.execute(workflow);

    expect(result.status).toBe(WorkflowStatus.COMPLETED);
    expect(result.results).toStrictEqual({
      result: 'Task task-default executed by agent agent-default'
    });
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
            id: 'sequence-1',
            name: 'Sequence 1',
            steps: ['parallel-1', 'merge-1'],
            type: NodeType.SEQUENCE
          },
          {
            branches: ['task-a', 'task-b'],
            failFast: true,
            id: 'parallel-1',
            name: 'Parallel 1',
            type: NodeType.PARALLEL
          },
          {
            agent: 'agent-seq',
            id: 'task-a',
            input: {},
            name: 'Task A',
            output: {},
            type: NodeType.TASK
          },
          {
            agent: 'agent-seq',
            id: 'task-b',
            input: {},
            name: 'Task B',
            output: {},
            type: NodeType.TASK
          },
          {
            id: 'merge-1',
            inputs: ['task-a', 'task-b'],
            name: 'Merge 1',
            strategy: 'all',
            type: NodeType.MERGE
          }
        ]
      })
    );

    const result = await engine.execute(workflow);
    const sequenceCandidate: unknown = result.results;

    expect(result.status).toBe(WorkflowStatus.COMPLETED);
    expect(Array.isArray(sequenceCandidate)).toBeTruthy();
    if (!Array.isArray(sequenceCandidate)) {
      throw new TypeError('Expected sequence result to be an array');
    }

    const sequenceResult = sequenceCandidate;
    expect(sequenceResult).toHaveLength(2);

    const mergeResult = sequenceResult[1] as { result: string }[];
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
            condition: 'true',
            falseBranch: ['task-false'],
            id: 'decision-1',
            name: 'Decision 1',
            trueBranch: ['task-true'],
            type: NodeType.DECISION
          },
          {
            agent: 'agent-decision',
            id: 'task-true',
            input: {},
            name: 'Task True',
            output: {},
            type: NodeType.TASK
          },
          {
            agent: 'agent-decision',
            id: 'task-false',
            input: {},
            name: 'Task False',
            output: {},
            type: NodeType.TASK
          }
        ]
      })
    );

    const result = await engine.execute(workflow);

    expect(result.status).toBe(WorkflowStatus.COMPLETED);
    expect(result.results).toStrictEqual({
      branch: 'true',
      decision: true,
      results: [{ result: 'Task task-true executed by agent agent-decision' }]
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
              id: 'sequence-invalid',
              name: 'Invalid Sequence',
              steps: ['missing-node'],
              type: NodeType.SEQUENCE
            }
          ]
        })
      )
    ).rejects.toThrow('Sequence node sequence-invalid references unknown node: missing-node');
  });
});
