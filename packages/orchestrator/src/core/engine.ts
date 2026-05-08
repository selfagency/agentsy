import { EventEmitter } from 'events';
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

// Stub interface for scheduler since @agentsy/scheduler is not yet implemented
interface TaskScheduler {
  schedule<T>(task: () => Promise<T>): Promise<T>;
  schedule(taskInfo: unknown, agents: unknown[]): Promise<unknown>;
}

export class OrchestrationEngine extends EventEmitter {
  private workflows = new Map<string, WorkflowContext>();
  private activeExecutions = new Map<string, WorkflowExecution>();

  constructor(
    private registry: AgentRegistry,
    private scheduler: TaskScheduler = { schedule: <T>(fn: () => Promise<T>) => fn() },
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

    const execution = new WorkflowExecution(workflow, options);
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
          duration: Date.now() - context.startTime!.getTime(),
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
    const nodeIds = new Set(spec.nodes.map(node => (node as any).id));
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

interface WorkflowContext {
  workflow: Workflow;
  status: WorkflowStatus;
  startTime: Date | null;
  endTime: Date | null;
  context: Record<string, unknown>;
}

interface ExecutionOptions {
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

class Workflow {
  public id: string;

  constructor(
    private spec: WorkflowSpec,
    private registry: AgentRegistry,
    private scheduler: TaskScheduler,
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

class WorkflowExecution {
  private cancelled = false;
  private nodeResults = new Map<string, unknown>();
  private registry: AgentRegistry;
  private scheduler: TaskScheduler;

  constructor(
    private workflow: Workflow,
    private options: ExecutionOptions,
  ) {
    this.registry = options.registry ?? ({ getAllAgents: () => [] } as unknown as AgentRegistry);

    const defaultScheduler: TaskScheduler = {
      schedule: <T>(fn: () => Promise<T>) => fn(),
    };

    // Add the second schedule method using function binding
    (
      defaultScheduler as unknown as {
        schedule(taskInfo: unknown, agents: unknown[]): Promise<unknown>;
      }
    ).schedule = (_taskInfo: unknown, _agents: unknown[]) => Promise.resolve({ agentId: 'mock' });

    this.scheduler = options.scheduler ?? defaultScheduler;
  }

  async run(): Promise<WorkflowResult> {
    const spec = this.workflow.getSpec();
    const startNode = spec.nodes[0] as WorkflowNode; // Start from first node

    try {
      const results = await this.executeNode(startNode);

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
    } catch (error) {
      throw error;
    }
  }

  private async executeNode(node: WorkflowNode): Promise<unknown> {
    if (this.cancelled) {
      throw new Error('Workflow cancelled');
    }

    switch (node.type) {
      case NodeType.TASK:
        return this.executeTaskNode(node as TaskNode);
      case NodeType.SEQUENCE:
        return this.executeSequenceNode(node as SequenceNode);
      default:
        throw new Error(`Unsupported node type: ${node.type}`);
    }
  }

  private async executeTaskNode(node: TaskNode): Promise<unknown> {
    // Find suitable agent
    const availableAgents = this.registry.getAllAgents().filter((a: AgentCapabilities) => a.available);
    const decision = await this.scheduler.schedule(
      {
        id: node.id,
        name: node.name,
        type: node.type,
        requirements: [], // Will be populated properly
        input: node.input,
        priority: 'high',
      },
      availableAgents,
    );

    if (!decision) {
      throw new Error(`No suitable agent found for task ${node.id}`);
    }

    // Execute task (placeholder - would integrate with actual agent execution)
    return { result: `Task ${node.id} executed by agent ${(decision as { agentId: string }).agentId}` };
  }

  private async executeSequenceNode(node: SequenceNode): Promise<unknown> {
    const results: unknown[] = [];

    for (const stepId of node.steps) {
      const stepNode = this.findNodeById(stepId);
      if (!stepNode) {
        throw new Error(`Step node ${stepId} not found`);
      }

      const result = await this.executeNode(stepNode);
      results.push(result);
    }

    return results;
  }

  private findNodeById(id: string): WorkflowNode | undefined {
    const spec = this.workflow.getSpec();
    return spec.nodes.find(node => (node as WorkflowNode).id === id) as WorkflowNode;
  }

  async cancel(): Promise<void> {
    this.cancelled = true;
  }
}

class WorkflowMonitor {
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
