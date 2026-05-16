export enum NodeType {
  TASK = "task",
  DECISION = "decision",
  PARALLEL = "parallel",
  SEQUENCE = "sequence",
  MERGE = "merge",
}

export enum WorkflowStatus {
  PENDING = "pending",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
}


export interface TaskNode {
  type: NodeType.TASK;
  id: string;
  name: string;
  agent: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  timeout?: number;
  retryPolicy?: RetryPolicy;
}

export interface DecisionNode {
  type: NodeType.DECISION;
  id: string;
  name: string;
  condition: string;
  trueBranch: string[];
  falseBranch: string[];
}

export interface ParallelNode {
  type: NodeType.PARALLEL;
  id: string;
  name: string;
  branches: string[];
  maxConcurrency?: number;
  failFast?: boolean;
}

export interface SequenceNode {
  type: NodeType.SEQUENCE;
  id: string;
  name: string;
  steps: string[];
  continueOnError?: boolean;
}

export interface MergeNode {
  type: NodeType.MERGE;
  id: string;
  name: string;
  inputs: string[];
  strategy: MergeStrategy;
}

export type WorkflowNode =
  | TaskNode
  | DecisionNode
  | ParallelNode
  | SequenceNode
  | MergeNode;

export type MergeStrategy = "join" | "first" | "all" | "majority";

export interface RetryPolicy {
  maxAttempts: number;
  backoffStrategy: "linear" | "exponential" | "fixed";
  baseDelay: number;
  maxDelay: number;
}

export interface Dependency {
  node: string;
  type: "sequential" | "data" | "resource";
}

export interface Constraint {
  type: "timing" | "resource" | "skill" | "cost";
  value: unknown;
}

export interface EventTrigger {
  event: string;
  source: string;
  condition?: string;
}

export interface EventHandler {
  event: string;
  handler: string;
  async?: boolean;
}

export interface EventFilter {
  event: string;
  condition: string;
  action: string;
}
