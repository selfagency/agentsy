export interface AtomicWorkflowContext {
  workflowId: string;
  startedAt: number;
  metadata: Record<string, unknown>;
}

export interface AtomicWorkflowStep {
  name: string;
  run(context: AtomicWorkflowContext): Promise<void>;
  rollback?(context: AtomicWorkflowContext): Promise<void>;
}

export interface AtomicWorkflowResult {
  workflowId: string;
  status: "committed" | "rolled_back";
  startedAt: number;
  finishedAt: number;
  executedSteps: string[];
  rolledBackSteps: string[];
  error?: Error;
}

export interface AtomicWorkflowCoordinator {
  runWorkflow(
    workflowId: string,
    steps: AtomicWorkflowStep[],
    metadata?: Record<string, unknown>
  ): Promise<AtomicWorkflowResult>;
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

async function rollbackExecutedSteps(
  context: AtomicWorkflowContext,
  executedSteps: AtomicWorkflowStep[]
): Promise<string[]> {
  const rolledBackSteps: string[] = [];

  for (let index = executedSteps.length - 1; index >= 0; index -= 1) {
    const step = executedSteps[index];
    if (!step?.rollback) {
      continue;
    }

    try {
      await step.rollback(context);
      rolledBackSteps.push(step.name);
    } catch {
      // Best-effort rollback: keep deterministic order and continue.
    }
  }

  return rolledBackSteps;
}

export function createAtomicWorkflowCoordinator(): AtomicWorkflowCoordinator {
  return {
    async runWorkflow(workflowId, steps, metadata = {}) {
      const startedAt = Date.now();
      const context: AtomicWorkflowContext = {
        metadata: { ...metadata },
        startedAt,
        workflowId,
      };

      const executedStepDefinitions: AtomicWorkflowStep[] = [];
      const executedSteps: string[] = [];

      try {
        for (const step of steps) {
          await step.run(context);
          executedStepDefinitions.push(step);
          executedSteps.push(step.name);
        }

        return {
          executedSteps,
          finishedAt: Date.now(),
          rolledBackSteps: [],
          startedAt,
          status: "committed",
          workflowId,
        };
      } catch (error) {
        const rolledBackSteps = await rollbackExecutedSteps(
          context,
          executedStepDefinitions
        );
        return {
          error: toError(error),
          executedSteps,
          finishedAt: Date.now(),
          rolledBackSteps,
          startedAt,
          status: "rolled_back",
          workflowId,
        };
      }
    },
  };
}
