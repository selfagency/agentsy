import { EventEmitter } from 'node:events';
import type {
  WorkflowSpec,
  WorkflowResult,
  WorkflowNode,
  TaskNode,
  DecisionNode,
  SequenceNode,
  AgentCapabilities,
} from '../types/index.js';
import { WorkflowStatus, NodeType } from '../types/index.js';
import type { AgentRegistry } from '../agents/registry.js';

// Stub interface for scheduler since @agentsy/orchestrator/scheduler is not yet implemented
export interface TaskScheduler {
  schedule<T>(task: TaskInput<T>): Promise<T>;
}

// Union type for scheduler input
type TaskInput<T> = (() => Promise<T>) | { taskInfo: unknown; agents: unknown[] };

// Exported interfaces for public API
export interface WorkflowContext {
  workflow: Workflow;
  status: WorkflowStatus;
  startTime: Date | null;
  endTime: Date | null;
  context: Record<string, unknown>;
}

export interface ExecutionOptions {
  registry?: AgentRegistry;
  scheduler?: TaskScheduler;
  resourceLimits?: {
    maxAgents?: number;
    maxCost?: number;
    maxDuration?: number;
  };
  monitoring?: boolean;
  recovery?: boolean;
}

export class Workflow {
  public id: string;

  constructor(
    private readonly spec: WorkflowSpec,
    private readonly registry: AgentRegistry,
    private readonly scheduler: TaskScheduler,
  ) {
    this.id = spec.id;
  }

  getSpec(): WorkflowSpec {
    return this.spec;
  }

  getId(): string {
    return this.id;
  }
}

export class WorkflowMonitor {
  constructor(private context: WorkflowContext) {}

  getStatus(): WorkflowStatus {
    return this.context.status;
  }

  getDuration(): number | null {
    if (!this.context.startTime) return null;
    const endTime = this.context.endTime || new Date();
    return endTime.getTime() - this.context.startTime.getTime();
  }

  isRunning(): boolean {
    return this.context.status === WorkflowStatus.RUNNING;
  }

  isCompleted(): boolean {
    return [WorkflowStatus.COMPLETED, WorkflowStatus.FAILED, WorkflowStatus.CANCELLED].includes(this.context.status);
  }
}

// Internal interfaces (not exported)
interface internalWorkflowExecution {
  workflow: Workflow;
  options: ExecutionOptions;
  run(): Promise<WorkflowResult>;
  cancel(): Promise<void>;
}

// Default scheduler implementation
class DefaultScheduler implements TaskScheduler {
  async schedule<T>(input: TaskInput<T>): Promise<T> {
    if (typeof input === 'function') {
      // Function variant
      return input();
    } else {
      // TaskInfo variant
      const { taskInfo, agents } = input as { taskInfo: unknown; agents: unknown[] };
      // Mock implementation for testing
      return { agentId: 'mock', assigned: true, status: 'scheduled' as const } as T;
    }
  }
}

function createDefaultScheduler(): TaskScheduler {
  return new DefaultScheduler();
}

// Workflow execution factory
function createWorkflowExecution(workflow: Workflow, options: ExecutionOptions): internalWorkflowExecution {
  const registry = options.registry ?? ({ getAllAgents: () => [] } as unknown as AgentRegistry);
  const scheduler = options.scheduler ?? createDefaultScheduler();

  let cancelled = false;
  const nodeResults = new Map<string, unknown>();

  return {
    workflow,
    options,
    async run(): Promise<WorkflowResult> {
      const spec = this.workflow.getSpec();
      const startNode = spec.nodes[0] as WorkflowNode; // Start from first node

      const results = await executeNode(startNode, this.workflow, registry, scheduler, cancelled, nodeResults);

      return {
        workflowId: this.workflow.getId(),
        status: WorkflowStatus.COMPLETED,
        results: (results ?? {}) as Record<string, unknown>,
        errors: [],
        metrics: {
          duration: 0, // Will be calculated by orchestration engine
          cost: 0,
          agentsUsed: 0,
        },
      };
    },

    async cancel(): Promise<void> {
      cancelled = true;
    },
  };
}

// Helper function to execute nodes
async function executeNode(
  node: WorkflowNode,
  workflow: Workflow,
  registry: AgentRegistry,
  scheduler: TaskScheduler,
  cancelled: boolean,
  nodeResults: Map<string, unknown>,
): Promise<unknown> {
  if (cancelled) {
    throw new Error('Workflow cancelled');
  }

  switch (node.type) {
    case NodeType.TASK:
      return executeTaskNode(node as TaskNode, registry, scheduler);
    case NodeType.SEQUENCE:
      return executeSequenceNode(node as SequenceNode, workflow, registry, scheduler, cancelled, nodeResults);
    default:
      throw new Error(`Unsupported node type: ${node.type}`);
  }
}

function executeTaskNode(node: TaskNode, registry: AgentRegistry, scheduler: TaskScheduler): Promise<unknown> {
  // Find suitable agent
  const availableAgents = registry.getAllAgents().filter((a: AgentCapabilities) => a.available);

  return scheduler
    .schedule({
      taskInfo: {
        id: node.id,
        name: node.name,
        type: node.type,
        requirements: [],
        input: node.input,
        priority: 'high',
      },
      agents: availableAgents,
    })
    .then(decision => {
      if (!decision) {
        throw new Error(`No suitable agent found for task ${node.id}`);
      }

      // Execute task (placeholder - would integrate with actual agent execution)
      return { result: `Task ${node.id} executed by agent ${(decision as { agentId: string }).agentId}` };
    });
}

async function executeSequenceNode(
  node: SequenceNode,
  workflow: Workflow,
  registry: AgentRegistry,
  scheduler: TaskScheduler,
  cancelled: boolean,
  nodeResults: Map<string, unknown>,
): Promise<unknown> {
  const results: unknown[] = [];

  for (const stepId of node.steps) {
    const stepNode = findNodeById(stepId, workflow);
    if (!stepNode) {
      throw new Error(`Step node ${stepId} not found`);
    }

    const result = await executeNode(stepNode, workflow, registry, scheduler, cancelled, nodeResults);
    results.push(result);
  }

  return results;
}

function findNodeById(id: string, workflow: Workflow): WorkflowNode | undefined {
  const spec = workflow.getSpec();
  return spec.nodes.find(node => (node as WorkflowNode).id === id) as WorkflowNode;
}

export class OrchestrationEngine extends EventEmitter {
  private workflows = new Map<string, WorkflowContext>();
  private activeExecutions = new Map<string, internalWorkflowExecution>();

  constructor(
    private registry: AgentRegistry,
    private scheduler: TaskScheduler = createDefaultScheduler(),
  ) {
    super();
  }

  async create(spec: WorkflowSpec): Promise<Workflow> {
    const workflow = new Workflow(spec, this.registry, this.scheduler);

    // Validate workflow
    this.validateWorkflow(workflow);

    this.workflows.set(workflow.id, {
      workflow,
      status: WorkflowStatus.PENDING,
      startTime: null,
      endTime: null,
      context: {},
    });

    this.emit('workflow:created', workflow.id);
    return workflow;
  }

  async execute(workflow: Workflow, options: ExecutionOptions = {}): Promise<WorkflowResult> {
    const context = this.workflows.get(workflow.id);
    if (!context) {
      throw new Error(`Workflow ${workflow.id} not found`);
    }

    if (this.activeExecutions.has(workflow.id)) {
      throw new Error(`Workflow ${workflow.id} already executing`);
    }

    const execution = createWorkflowExecution(workflow, options);
    this.activeExecutions.set(workflow.id, execution);

    context.status = WorkflowStatus.RUNNING;
    context.startTime = new Date();
    this.emit('workflow:started', workflow.id);

    try {
      const result = await execution.run();

      context.status = result.status;
      context.endTime = new Date();
      this.activeExecutions.delete(workflow.id);

      this.emit('workflow:completed', workflow.id, result);
      return result;
    } catch (error) {
      context.status = WorkflowStatus.FAILED;
      context.endTime = new Date();
      this.activeExecutions.delete(workflow.id);

      const result: WorkflowResult = {
        workflowId: workflow.id,
        status: WorkflowStatus.FAILED,
        results: {},
        errors: [error instanceof Error ? error.message : String(error)],
        metrics: {
          duration: context.startTime ? Date.now() - context.startTime.getTime() : 0,
          cost: 0,
          agentsUsed: 0,
        },
      };

      this.emit('workflow:failed', workflow.id, result);
      return result;
    }
  }

  monitor(workflowId: string): WorkflowMonitor {
    const context = this.workflows.get(workflowId);
    if (!context) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    return new WorkflowMonitor(context);
  }

  async cancel(workflowId: string): Promise<void> {
    const execution = this.activeExecutions.get(workflowId);
    if (execution) {
      await execution.cancel();

      const context = this.workflows.get(workflowId);
      if (context) {
        context.status = WorkflowStatus.CANCELLED;
        context.endTime = new Date();
      }

      this.activeExecutions.delete(workflowId);
      this.emit('workflow:cancelled', workflowId);
    }
  }

  private validateWorkflow(workflow: Workflow): void {
    const spec = workflow.getSpec();

    // Check for required nodes
    if (!spec.nodes || spec.nodes.length === 0) {
      throw new Error('Workflow must have at least one node');
    }

    // Validate node connections
    const nodeIds = new Set(spec.nodes.map(node => (node as WorkflowNode).id));
    for (const node of spec.nodes) {
      const workflowNode = node as WorkflowNode;
      if (workflowNode.type === NodeType.DECISION) {
        const decisionNode = workflowNode as DecisionNode;
        for (const targetId of [...decisionNode.trueBranch, ...decisionNode.falseBranch]) {
          if (!nodeIds.has(targetId)) {
            throw new Error(`Decision node ${workflowNode.id} references unknown node: ${targetId}`);
          }
        }
      }
    }
  }
}
