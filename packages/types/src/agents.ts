/**
 * Agent execution and orchestration types.
 */

/**
 * Status of an agent execution.
 */
export enum AgentStatus {
  IDLE = 'idle',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  STOPPED = 'stopped',
}

/**
 * Conditions under which an agent loop should stop execution.
 */
export type StopCondition =
  | { type: 'max_steps'; limit: number }
  | { type: 'max_tokens'; limit: number }
  | { type: 'time_budget'; ms: number }
  | { type: 'manual' };

/**
 * Result metadata for a single agent loop step.
 */
export interface StepResult {
  /** Step index in the loop. */
  stepIndex: number;

  /** Status of the step. */
  status: 'success' | 'error' | 'stopped';

  /** Output from the step (message, tool calls, etc.). */
  output?: unknown;

  /** Token usage for this step. */
  usage?: { prompt: number; completion: number };

  /** Error if execution failed. */
  error?: Error;
}

/**
 * Complete state of the agent loop.
 */
export interface AgentLoopState {
  /** Current step index. */
  stepIndex: number;

  /** Execution status. */
  status: AgentStatus;

  /** Accumulated results from executed steps. */
  results: StepResult[];

  /** Current stop condition, if any. */
  stopCondition?: StopCondition;

  /** Aggregated token usage. */
  totalTokens: { prompt: number; completion: number };
}

/**
 * Context passed to agent during loop execution.
 */
export interface AgentLoopContext {
  /** Session identifier. */
  sessionId: string;

  /** Agent identifier. */
  agentId: string;

  /** Current loop step index. */
  stepIndex: number;

  /** Stop conditions for loop. */
  stopConditions?: StopCondition[];

  /** Runtime task context for spawning child tasks. */
  runtimeContext?: {
    sessionId: string;
    depth: number;
    spawn(tasks: unknown[], signal?: AbortSignal, sessionId?: string): Promise<unknown>;
  };
}
