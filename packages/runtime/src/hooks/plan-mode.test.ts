import { describe, expect, it } from 'vitest';

import {
  createAgentSession,
  formatPlan,
  generatePlan,
  type PlanAgentDefinition,
  type SessionOptions
} from './plan-mode.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const testAgentDef: PlanAgentDefinition = {
  id: 'test-agent',
  name: 'Test Agent',
  description: 'An agent used for testing plan mode'
};

const defaultOptions: SessionOptions = {
  agentId: 'test-agent'
};

// ---------------------------------------------------------------------------
// generatePlan
// ---------------------------------------------------------------------------

describe('generatePlan', () => {
  it('creates a plan with tasks derived from the input', () => {
    const plan = generatePlan('Research the topic. Draft a summary. Review the draft.', testAgentDef);

    expect(plan.tasks).toHaveLength(3);
    expect(plan.tasks[0]?.description).toBe('Research the topic');
    expect(plan.tasks[1]?.description).toBe('Draft a summary');
    expect(plan.tasks[2]?.description).toBe('Review the draft');
  });

  it('assigns sequential task ids', () => {
    const plan = generatePlan('Task A. Task B. Task C.', testAgentDef);

    expect(plan.tasks.map(t => t.id)).toEqual(['task_01', 'task_02', 'task_03']);
  });

  it('builds linear dependencies for sequential tasks', () => {
    const plan = generatePlan('One. Two. Three.', testAgentDef);

    expect(plan.dependencies.task_01).toEqual([]);
    expect(plan.dependencies.task_02).toEqual(['task_01']);
    expect(plan.dependencies.task_03).toEqual(['task_02']);
  });

  it('creates a parallel dependency layout when input mentions parallel', () => {
    const plan = generatePlan('Design the API. Implement the API parallel. Write tests.', testAgentDef);

    // First two tasks should have no dependencies (parallel)
    expect(plan.dependencies.task_01).toEqual([]);
    expect(plan.dependencies.task_02).toEqual([]);
  });

  it('returns an estimate with total steps and token count', () => {
    const plan = generatePlan('Step one. Step two. Step three.', testAgentDef);

    expect(plan.estimate.totalSteps).toBe(3);
    expect(plan.estimate.parallelGroups).toBeGreaterThanOrEqual(1);
    expect(plan.estimate.estimatedTokens).toBe(1500); // 3 × 500
  });

  it('returns empty plan for empty input', () => {
    const plan = generatePlan('', testAgentDef);

    expect(plan.tasks).toHaveLength(0);
    expect(plan.estimate.totalSteps).toBe(0);
    expect(plan.estimate.estimatedTokens).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// formatPlan
// ---------------------------------------------------------------------------

describe('formatPlan', () => {
  it('renders a markdown representation of the plan', () => {
    const plan = generatePlan('Research. Build. Ship.', testAgentDef);
    const formatted = formatPlan(plan);

    expect(formatted).toContain('## Plan');
    expect(formatted).toContain('**task_01**');
    expect(formatted).toContain('**task_02**');
    expect(formatted).toContain('**task_03**');
    expect(formatted).toContain('Research');
    expect(formatted).toContain('Build');
    expect(formatted).toContain('Ship');
    expect(formatted).toContain('### Estimate');
    expect(formatted).toContain('Plan mode');
  });
});

// ---------------------------------------------------------------------------
// createAgentSession — plan mode
// ---------------------------------------------------------------------------

describe('createAgentSession (plan mode)', () => {
  it('returns a handle with mode === "plan" when plan: true', async () => {
    const handle = await createAgentSession(testAgentDef, { ...defaultOptions, plan: true });

    expect(handle.mode).toBe('plan');
  });

  it('returns a handle with mode === "execute" when plan: false', async () => {
    const handle = await createAgentSession(testAgentDef, { ...defaultOptions, plan: false });

    expect(handle.mode).toBe('execute');
  });

  it('returns a handle with mode === "execute" when plan is omitted', async () => {
    const handle = await createAgentSession(testAgentDef, defaultOptions);

    expect(handle.mode).toBe('execute');
  });

  it('step() includes plan in result when in plan mode', async () => {
    const handle = await createAgentSession(testAgentDef, { ...defaultOptions, plan: true });
    const result = await handle.step('Design. Implement. Test.');

    expect(result.plan).toBeDefined();
    expect(result.plan?.tasks).toHaveLength(3);
    expect(result.text).toContain('## Plan');
  });

  it('step() does not include plan in result in execute mode', async () => {
    const handle = await createAgentSession(testAgentDef, { ...defaultOptions, plan: false });
    const result = await handle.step('Design. Implement. Test.');

    expect(result.plan).toBeUndefined();
  });

  it('getPlan() returns null before any step call', async () => {
    const handle = await createAgentSession(testAgentDef, { ...defaultOptions, plan: true });

    expect(handle.getPlan()).toBeNull();
  });

  it('getPlan() returns the generated plan after step()', async () => {
    const handle = await createAgentSession(testAgentDef, { ...defaultOptions, plan: true });
    await handle.step('Research the topic. Write documentation.');

    const plan = handle.getPlan();
    expect(plan).not.toBeNull();
    expect(plan?.tasks).toHaveLength(2);
    expect(plan?.tasks[0]?.description).toBe('Research the topic');
  });

  it('getPlan() is null in execute mode', async () => {
    const handle = await createAgentSession(testAgentDef, { ...defaultOptions, plan: false });
    await handle.step('Design. Implement.');

    expect(handle.getPlan()).toBeNull();
  });

  it('step() in execute mode returns a passthrough message', async () => {
    const handle = await createAgentSession(testAgentDef, { ...defaultOptions, plan: false });
    const result = await handle.step('Do something.');

    expect(result.text).toContain('[execute mode]');
    expect(result.text).toContain('test-agent');
    expect(result.text).toContain('Do something.');
  });
});
