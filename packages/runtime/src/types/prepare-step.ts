/**
 * Prepare step hook result for RAG-style output shaping.
 * 之所 hook 责责：RAG style output shaping hook
 */
export type PrepareStepResult = {
  events: AgUiEvent[];
  state: unknown;
};

/**
 * Prepare step hook signature for pre-processing step execution.
 */
export type PrepareStepHook = (context: PrepareStepContext) => PrepareStepResult | Promise<PrepareStepResult>;

/**
 * Prepare step context provides execution context for step preparation.
 */
export interface PrepareStepContext {
  runId: string;
  threadId?: string;
  stepIndex: number;
  currentMessages: unknown[];
  accumulatedState: unknown;
  agentCapabilities: AgentCapabilities;
  stopConditions: StopCondition[];
}

export type AgentCapabilities = {
  canAcceptUserInput?: boolean;
  canRetry?: boolean;
  canInterrupt?: boolean;
  supportedTools?: ToolCapability[];
  supportedMessageFormats?: string[];
};

export type ToolCapability = {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
  returnType?: string;
};

export type StopCondition = (state: AgentLoopState) => boolean;

export interface AgentLoopState {
  steps: StepResult[];
  stepIndex: number;
  lastOutput: ProcessorOutput;
  toolCallCount: number;
  consecutiveIdenticalCalls: number;
  startTime: number;
  errorCount: number;
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

export type AgUiEvent = {
  type: string;
  runId: string;
  timestamp?: string;
  [key: string]: unknown;
};

/**
 * RAG-style event filter for memory-aware event emission.
 */
export interface RagEventFilter {
  /**
   * Filter events based on memory context.
   */
  filterByMemory(events: AgUiEvent[], memoryContext: MemoryContext): AgUiEvent[];

  /**
   * Enrich events with memory citations.
   */
  enrichWithCitations(events: AgUiEvent[], memoryMatches: unknown[]): AgUiEvent[];

  /**
   * Transform events for output shaping.
   */
  transformEvents(events: AgUiEvent[], transform: EventTransform): AgUiEvent[];
}

export interface MemoryContext {
  currentContext: string;
  relevantMemories: unknown[];
  memorySize: number;
  memoryLimit: number;
}

export interface EventTransform {
  type: string;
  transform: (event: AgUiEvent) => AgUiEvent;
}

/**
 * Prepare step hook registry for managing multiple prepare step hooks.
 */
export interface PrepareStepHookRegistry {
  /**
   * Register a prepare step hook.
   */
  register(hook: PrepareStepHookDefinition): void;

  /**
   * Unregister a prepare step hook by name.
   */
  unregister(name: string): void;

  /**
   * Execute all registered prepare step hooks.
   */
  executeAll(context: PrepareStepContext): PrepareStepResult | Promise<PrepareStepResult>;

  /**
   * Get registered hooks by priority.
   */
  getHooks(): PrepareStepHookDefinition[];
}

export interface PrepareStepHookDefinition {
  name: string;
  priority: number;
  hook: PrepareStepHook;
  metadata?: Record<string, unknown>;
}

/**
 * Prepare step result with execution metadata.
 */
export interface PrepareStepResultWithMetadata extends PrepareStepResult {
  metadata: {
    executionTime: number;
    hooksExecuted: string[];
    stateChanges: StateChange[];
  };
}

export interface StateChange {
  type: string;
  path: string;
  previousValue: unknown;
  newValue: unknown;
}

/**
 * Prepare step hook quality metrics for hook performance monitoring.
 */
export interface PrepareStepHookMetrics {
  hookName: string;
  executionCount: number;
  averageExecutionTime: number;
  successCount: number;
  errorCount: number;
  lastExecutionTime: number;
}
