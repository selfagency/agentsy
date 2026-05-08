/**
 * AG-UI Protocol Event Types
 *
 * Defines locally-compatible AG-UI event types without requiring @ag-ui/core as a hard dependency.
 * Structurally matches the AG-UI specification: https://docs.ag-ui.com/
 *
 * This library emits events in this format, positioning llm-stream-parser as a "direct-to-LLM"
 * AG-UI backend for any provider → normalize → emit AG-UI events → any AG-UI frontend.
 */

/**
 * All AG-UI event types.
 * Mirrors @ag-ui/core EventType.
 */
export enum EventType {
  // Run lifecycle
  RUN_STARTED = 'run:started',
  RUN_FINISHED = 'run:finished',
  RUN_ERROR = 'run:error',
  RUN_INTERRUPTED = 'run:interrupted',

  // Step tracking
  STEP_STARTED = 'step:started',
  STEP_FINISHED = 'step:finished',

  // Text streaming
  TEXT_MESSAGE_START = 'text_message:start',
  TEXT_MESSAGE_CONTENT = 'text_message:content',
  TEXT_MESSAGE_END = 'text_message:end',

  // Reasoning / thinking
  REASONING_START = 'reasoning:start',
  REASONING_MESSAGE_START = 'reasoning_message:start',
  REASONING_MESSAGE_CONTENT = 'reasoning_message:content',
  REASONING_MESSAGE_END = 'reasoning_message:end',
  REASONING_END = 'reasoning:end',

  // Tool calls
  TOOL_CALL_START = 'tool_call:start',
  TOOL_CALL_ARGS = 'tool_call:args',
  TOOL_CALL_END = 'tool_call:end',
  TOOL_CALL_RESULT = 'tool_call:result',

  // Messages
  MESSAGES_SNAPSHOT = 'messages:snapshot',

  // State
  STATE_SNAPSHOT = 'state:snapshot',
  STATE_DELTA = 'state:delta',

  // Interrupts
  INTERRUPT = 'interrupt',

  // Metadata
  METADATA_UPDATE = 'metadata:update',

  // Token budget & input shaping (P0: CONTEXT_WINDOW_WILL_OVERFLOW, CHAT_COMPRESSED)
  CONTEXT_WINDOW_WILL_OVERFLOW = 'context_window:will_overflow',
  CHAT_COMPRESSED = 'chat:compressed',

  // Safety & recovery (P0: LOOP_DETECTED, INVALID_STREAM, MEMORY_INJECTION_SUSPECTED)
  LOOP_DETECTED = 'loop:detected',
  INVALID_STREAM = 'invalid_stream',
  MEMORY_INJECTION_SUSPECTED = 'memory_injection:suspected',

  // Observable features (P0: CITATION, RETRY, COST_THRESHOLD_EXCEEDED)
  CITATION = 'citation',
  RETRY = 'retry',
  COST_THRESHOLD_EXCEEDED = 'cost_threshold:exceeded',
}

/**
 * Base shape for all AG-UI events.
 */
export interface BaseEvent {
  type: EventType;
  runId: string;
  threadId?: string;
  timestamp?: string;
  parentRunId?: string;
  [key: string]: unknown;
}

// ========== Run Lifecycle Events ==========

export interface RunStartedEvent extends BaseEvent {
  type: EventType.RUN_STARTED;
  capabilities?: AgentCapabilities;
}

export interface RunFinishedEvent extends BaseEvent {
  type: EventType.RUN_FINISHED;
  outcome?: {
    type: 'success' | 'error' | 'interrupt';
    message?: string;
    interrupts?: Interrupt[];
  };
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
}

export interface RunErrorEvent extends BaseEvent {
  type: EventType.RUN_ERROR;
  error: {
    message: string;
    code?: string;
  };
}

export interface RunInterruptedEvent extends BaseEvent {
  type: EventType.RUN_INTERRUPTED;
  interrupts: Interrupt[];
}

// ========== Step Events ==========

export interface StepStartedEvent extends BaseEvent {
  type: EventType.STEP_STARTED;
  stepIndex: number;
  stepId?: string;
}

export interface StepFinishedEvent extends BaseEvent {
  type: EventType.STEP_FINISHED;
  stepIndex: number;
  stepId?: string;
  outputLength?: number;
  duration?: number;
}

// ========== Text Streaming Events ==========

export interface TextMessageStartEvent extends BaseEvent {
  type: EventType.TEXT_MESSAGE_START;
  messageId: string;
}

export interface TextMessageContentEvent extends BaseEvent {
  type: EventType.TEXT_MESSAGE_CONTENT;
  messageId: string;
  content: string;
}

export interface TextMessageEndEvent extends BaseEvent {
  type: EventType.TEXT_MESSAGE_END;
  messageId: string;
}

// ========== Reasoning Events ==========

export interface ReasoningStartEvent extends BaseEvent {
  type: EventType.REASONING_START;
  messageId: string;
}

export interface ReasoningMessageStartEvent extends BaseEvent {
  type: EventType.REASONING_MESSAGE_START;
  messageId: string;
}

export interface ReasoningMessageContentEvent extends BaseEvent {
  type: EventType.REASONING_MESSAGE_CONTENT;
  messageId: string;
  content: string;
  encryptedValue?: string;
}

export interface ReasoningMessageEndEvent extends BaseEvent {
  type: EventType.REASONING_MESSAGE_END;
  messageId: string;
}

export interface ReasoningEndEvent extends BaseEvent {
  type: EventType.REASONING_END;
  messageId: string;
}

// ========== Tool Call Events ==========

export interface ToolCallStartEvent extends BaseEvent {
  type: EventType.TOOL_CALL_START;
  toolCallId: string;
  toolName: string;
}

export interface ToolCallArgsEvent extends BaseEvent {
  type: EventType.TOOL_CALL_ARGS;
  toolCallId: string;
  args: Record<string, unknown>;
}

export interface ToolCallEndEvent extends BaseEvent {
  type: EventType.TOOL_CALL_END;
  toolCallId: string;
}

export interface ToolCallResultEvent extends BaseEvent {
  type: EventType.TOOL_CALL_RESULT;
  toolCallId: string;
  result: string;
  isError?: boolean;
}

// ========== Message Snapshot Events ==========

export interface MessagesSnapshotEvent extends BaseEvent {
  type: EventType.MESSAGES_SNAPSHOT;
  messages: Message[];
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  reasoning?: string;
  timestamp?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: string;
  isError?: boolean;
}

// ========== State Events ==========

export interface StateSnapshotEvent extends BaseEvent {
  type: EventType.STATE_SNAPSHOT;
  state: unknown;
}

export interface StateDeltaEvent extends BaseEvent {
  type: EventType.STATE_DELTA;
  ops: JsonPatchOperation[];
}

/**
 * RFC 6902 JSON Patch operation.
 */
export interface JsonPatchOperation {
  op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';
  path: string;
  value?: unknown;
  from?: string;
}

// ========== Interrupt Events ==========

export interface InterruptEvent extends BaseEvent {
  type: EventType.INTERRUPT;
  interruptId: string;
  reason: string;
  options?: Record<string, unknown>;
}

export interface Interrupt {
  id: string;
  reason: string;
  options?: Record<string, unknown>;
}

// ========== Metadata Events ==========

export interface MetadataUpdateEvent extends BaseEvent {
  type: EventType.METADATA_UPDATE;
  metadata: Record<string, unknown>;
}

// ========== Token Budget & Input Shaping Events ==========

export interface ContextWindowWillOverflowEvent extends BaseEvent {
  type: EventType.CONTEXT_WINDOW_WILL_OVERFLOW;
  windowSize: number;
  currentUsage: number;
  projectSize?: number;
  overflowThreshold?: number;
}

export interface ChatCompressedEvent extends BaseEvent {
  type: EventType.CHAT_COMPRESSED;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  windowRemaining: number;
  method: 'truncation' | 'summarization' | 'checkpoint';
}

// ========== Safety & Recovery Events ==========

export interface LoopDetectedEvent extends BaseEvent {
  type: EventType.LOOP_DETECTED;
  loopType: 'repetition' | 'state_drift' | 'failed_early_exit';
  iterationCount: number;
  stateHashes?: string[];
  correctiveAction: string;
}

export interface InvalidStreamEvent extends BaseEvent {
  type: EventType.INVALID_STREAM;
  reason: string;
  position?: number;
  chunk?: string;
  recoveryMode?: 'partial_skip' | 'reparse' | 'fallback';
}

export interface MemoryInjectionSuspectedEvent extends BaseEvent {
  type: EventType.MEMORY_INJECTION_SUSPECTED;
  detectionSource: 'pattern' | 'volume' | 'structure';
  severity: 'low' | 'medium' | 'high';
  evidence?: string[];
}

// ========== Observable Features Events ==========

export interface CitationEvent extends BaseEvent {
  type: EventType.CITATION;
  sourceId: string;
  sourceType: string;
  startPosition: number;
  endPosition: number;
  metadata?: Record<string, unknown>;
}

export interface RetryEvent extends BaseEvent {
  type: EventType.RETRY;
  attemptNumber: number;
  maxAttempts: number;
  reason: string;
  delayMillis?: number;
}

export interface CostThresholdExceededEvent extends BaseEvent {
  type: EventType.COST_THRESHOLD_EXCEEDED;
  currentCost: number;
  threshold: number;
  currency?: string;
  action: 'warn' | 'stop' | 'stream_drop';
}

// ========== Agent Capabilities ==========

/**
 * Describes what capabilities the agent supports.
 */
export interface AgentCapabilities {
  canAcceptUserInput?: boolean;
  canRetry?: boolean;
  canInterrupt?: boolean;
  supportedTools?: ToolCapability[];
  supportedMessageFormats?: string[];
}

export interface ToolCapability {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
  returnType?: string;
}

// ========== Union type for all events ==========

export type AgUiEvent =
  | RunStartedEvent
  | RunFinishedEvent
  | RunErrorEvent
  | RunInterruptedEvent
  | StepStartedEvent
  | StepFinishedEvent
  | TextMessageStartEvent
  | TextMessageContentEvent
  | TextMessageEndEvent
  | ReasoningStartEvent
  | ReasoningMessageStartEvent
  | ReasoningMessageContentEvent
  | ReasoningMessageEndEvent
  | ReasoningEndEvent
  | ToolCallStartEvent
  | ToolCallArgsEvent
  | ToolCallEndEvent
  | ToolCallResultEvent
  | MessagesSnapshotEvent
  | StateSnapshotEvent
  | StateDeltaEvent
  | InterruptEvent
  | MetadataUpdateEvent
  | ContextWindowWillOverflowEvent
  | ChatCompressedEvent
  | LoopDetectedEvent
  | InvalidStreamEvent
  | MemoryInjectionSuspectedEvent
  | CitationEvent
  | RetryEvent
  | CostThresholdExceededEvent;
