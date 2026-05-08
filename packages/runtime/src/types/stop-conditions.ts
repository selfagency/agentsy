/**
 * Stop condition function signature for agent loop termination logic.
 * Accepts agent loop state and returns boolean indicating whether to stop.
 */
export type StopCondition = (state: AgentLoopState) => boolean;

/**
 * Agent loop state snapshot for stop condition evaluation.
 * Captures current execution state for termination decisions.
 */
export interface AgentLoopState {
  steps: StepResult[];
  stepIndex: number;
  lastOutput: ProcessorOutput;
  toolCallCount: number;
  consecutiveIdenticalCalls: number;
  startTime: number;
  errorCount: number;
  warnings: Warning[];
}

export interface StepResult {
  output: ProcessorOutput;
  toolCalls: Array<{ name: string; parameters: Record<string, unknown> }>;
  finishReason?: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
  duration?: number;
}

export interface ProcessorOutput {
  thinking: string;
  content: string;
  toolCalls: Array<{ name: string; parameters: Record<string, unknown> }>;
  done: boolean;
  parts: OutputPart[];
  incomplete: boolean;
  incompleteness: Incompleteness[];
}

export interface OutputPart {
  type: 'thinking' | 'content' | 'tool_call' | 'error' | 'done';
  content?: string;
  toolCall?: { name: string; parameters: Record<string, unknown> };
  error?: string;
  done?: boolean;
}

export interface Incompleteness {
  type: string;
  message: string;
}

export interface Warning {
  type: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
  timestamp: string;
}

/**
 * Pre-built stop condition factories.
 */
export interface StopConditionFactories {
  /**
   * Stop after maximum steps.
   */
  maxSteps: (max: number) => StopCondition;

  /**
   * Stop on maximum tool calls.
   */
  maxToolCalls: (max: number) => StopCondition;

  /**
   * Stop on consecutive identical tool calls (loop detection).
   */
  consecutiveIdenticalCalls: (max: number) => StopCondition;

  /**
   * Stop on maximum duration.
   */
  maxDuration: (maxMillis: number) => StopCondition;

  /**
   * Stop on maximum error count.
   */
  maxErrors: (max: number) => StopCondition;

  /**
   * Stop on specific finish reason.
   */
  finishReason: (reason: string) => StopCondition;

  /**
   * Stop on custom predicate.
   */
  custom: (predicate: (state: AgentLoopState) => boolean) => StopCondition;

  /**
   * Combine multiple stop conditions with AND logic.
   */
  and: (...conditions: StopCondition[]) => StopCondition;

  /**
   * Combine multiple stop conditions with OR logic.
   */
  or: (...conditions: StopCondition[]) => StopCondition;

  /**
   * Negate a stop condition.
   */
  not: (condition: StopCondition) => StopCondition;
}

/**
 * Stop condition with associated event emission.
 */
export interface StopConditionWithEvent {
  condition: StopCondition;
  eventType: string;
  message: string;
  metadata?: Record<string, unknown>;
}

/**
 * Stop condition evaluation result.
 */
export interface StopConditionEvaluation {
  shouldStop: boolean;
  triggeredConditions: Array<{
    condition: StopCondition;
    reason: string;
  }>;
  stateSnapshot: AgentLoopState;
}

/**
 * Composite stop condition for complex termination logic.
 */
export interface CompositeStopCondition {
  conditions: Array<{
    condition: StopCondition;
    operator: 'AND' | 'OR' | 'NOT';
    metadata?: Record<string, unknown>;
  }>;
  evaluate: (state: AgentLoopState) => boolean;
}
