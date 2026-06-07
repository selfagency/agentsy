import { describe, expect, it } from 'vitest';

import type {
  ApprovalGate,
  AutoGate,
  CheckpointSnapshot,
  ExecutedStep,
  FailedStepRecord,
  HumanInLoopGate,
  PausedInterval,
  PlannedStep,
  SuccessGate,
  VerificationGate,
  WorkflowExecution,
  WorkflowPlan
} from './plan.js';
import { ExecutionStatus, StepStatus, StepType } from './plan.js';

describe('WorkflowPlan', () => {
  it('should construct a valid WorkflowPlan with all required fields', () => {
    const plan: WorkflowPlan = {
      id: 'plan-1',
      name: 'Test Plan',
      version: '1.0.0',
      steps: [],
      metadata: { author: 'test', confidence: 0.9 }
    };
    expect(plan.id).toBe('plan-1');
    expect(plan.name).toBe('Test Plan');
    expect(plan.version).toBe('1.0.0');
    expect(plan.steps).toEqual([]);
    expect(plan.metadata).toEqual({ author: 'test', confidence: 0.9 });
  });
});

describe('PlannedStep', () => {
  it('should construct a valid PlannedStep with all fields', () => {
    const step: PlannedStep = {
      id: 'step-1',
      type: 'task',
      task: 'Do something',
      input: { key: 'value' },
      dependencies: ['step-0'],
      condition: 'ctx.ready === true',
      timeoutMs: 5000,
      maxRetries: 3,
      checkpointRequired: true,
      metadata: { tier: 'mid' },
      intent: 'Perform the action'
    };
    expect(step.id).toBe('step-1');
    expect(step.type).toBe('task');
    expect(step.dependencies).toEqual(['step-0']);
    expect(step.checkpointRequired).toBe(true);
    expect(step.maxRetries).toBe(3);
  });

  it('should accept a minimal PlannedStep with optional fields omitted', () => {
    const step: PlannedStep = {
      id: 'step-2',
      type: 'decision',
      task: 'Decide path',
      input: {},
      dependencies: [],
      checkpointRequired: false,
      metadata: {},
      intent: 'Make a decision'
    };
    expect(step.timeoutMs).toBeUndefined();
    expect(step.condition).toBeUndefined();
    expect(step.maxRetries).toBeUndefined();
  });
});

describe('SuccessGate discriminated union', () => {
  it('should construct an ApprovalGate with role and timeoutMs', () => {
    const gate: SuccessGate = {
      type: 'approval',
      role: 'admin',
      timeoutMs: 60_000
    };
    expect(gate.type).toBe('approval');
    if (gate.type === 'approval') {
      expect(gate.role).toBe('admin');
      expect(gate.timeoutMs).toBe(60_000);
    }
  });

  it('should construct an AutoGate with condition', () => {
    const gate: SuccessGate = {
      type: 'auto',
      condition: 'ctx.status === "ok"'
    };
    expect(gate.type).toBe('auto');
    if (gate.type === 'auto') {
      expect(gate.condition).toBe('ctx.status === "ok"');
    }
  });

  it('should construct a VerificationGate with checkId and strategy', () => {
    const gate: SuccessGate = {
      type: 'verification',
      checkId: 'test-pass',
      strategy: 'test-run'
    };
    expect(gate.type).toBe('verification');
    if (gate.type === 'verification') {
      expect(gate.checkId).toBe('test-pass');
      expect(gate.strategy).toBe('test-run');
    }
  });

  it('should construct a HumanInLoopGate with agent and timeoutMinutes', () => {
    const gate: SuccessGate = {
      type: 'human-in-loop',
      agent: 'senior-dev',
      timeoutMinutes: 15
    };
    expect(gate.type).toBe('human-in-loop');
    if (gate.type === 'human-in-loop') {
      expect(gate.agent).toBe('senior-dev');
      expect(gate.timeoutMinutes).toBe(15);
    }
  });
});

describe('WorkflowExecution', () => {
  it('should construct with all fields', () => {
    const execution: WorkflowExecution = {
      id: 'exec-1',
      planId: 'plan-1',
      status: 'running',
      startedAt: '2026-01-01T00:00:00.000Z',
      steps: [],
      currentStep: 'step-1',
      checkpoints: [],
      pauseResume: []
    };
    expect(execution.status).toBe('running');
    expect(execution.currentStep).toBe('step-1');
  });
});

describe('ExecutedStep', () => {
  it('should track attempts and status', () => {
    const step: ExecutedStep = {
      stepId: 'step-1',
      stepName: 'Test Step',
      status: 'completed',
      startedAt: '2026-01-01T00:00:00.000Z',
      attempts: 3,
      output: { result: 'ok' },
      executionPath: ['step-0', 'step-1']
    };
    expect(step.attempts).toBe(3);
    expect(step.status).toBe('completed');
    expect(step.executionPath).toEqual(['step-0', 'step-1']);
  });

  it('should allow failed status with error', () => {
    const step: ExecutedStep = {
      stepId: 'step-2',
      stepName: 'Failing Step',
      status: 'failed',
      startedAt: '2026-01-01T00:00:00.000Z',
      attempts: 1,
      error: 'Something went wrong'
    };
    expect(step.status).toBe('failed');
    expect(step.error).toBe('Something went wrong');
  });
});

describe('CheckpointSnapshot', () => {
  it('should store data and timestamp', () => {
    const snapshot: CheckpointSnapshot = {
      id: 'cp-1',
      stepId: 'step-1',
      attempt: 2,
      data: { progress: 0.5, context: { key: 'val' } },
      timestamp: '2026-01-01T00:00:00.000Z'
    };
    expect(snapshot.data).toEqual({ progress: 0.5, context: { key: 'val' } });
    expect(snapshot.timestamp).toBe('2026-01-01T00:00:00.000Z');
    expect(snapshot.attempt).toBe(2);
  });
});

describe('FailedStepRecord', () => {
  it('should record failure details', () => {
    const record: FailedStepRecord = {
      stepId: 'step-1',
      stepName: 'Failed Step',
      error: 'Timeout',
      attempt: 2,
      willRetry: true,
      timestamp: '2026-01-01T00:00:00.000Z'
    };
    expect(record.willRetry).toBe(true);
    expect(record.attempt).toBe(2);
  });
});

describe('PausedInterval', () => {
  it('should record pause and optional resume', () => {
    const interval: PausedInterval = {
      stepId: 'step-1',
      startTime: '2026-01-01T00:00:00.000Z',
      pausedBy: 'admin'
    };
    expect(interval.resumedAt).toBeUndefined();

    const resumed: PausedInterval = {
      ...interval,
      resumedAt: '2026-01-01T01:00:00.000Z'
    };
    expect(resumed.resumedAt).toBeDefined();
  });
});

describe('StepType constants', () => {
  it('should have all expected values', () => {
    expect(StepType).toEqual({
      TASK: 'task',
      DECISION: 'decision',
      PARALLEL: 'parallel',
      SEQUENCE: 'sequence',
      GATE: 'gate',
      SUBPLAN: 'subplan'
    });
  });
});

describe('ExecutionStatus constants', () => {
  it('should have all expected values', () => {
    expect(ExecutionStatus.PENDING).toBe('pending');
    expect(ExecutionStatus.FAILED).toBe('failed');
    expect(ExecutionStatus.CANCELLED).toBe('cancelled');
  });
});

describe('StepStatus constants', () => {
  it('should have all expected values', () => {
    expect(StepStatus.SKIPPED).toBe('skipped');
    expect(StepStatus.RUNNING).toBe('running');
  });
});
