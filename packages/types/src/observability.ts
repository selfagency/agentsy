/**
 * Observability and distributed tracing types including AG-UI protocol events.
 */

export enum EventType {
  RUN_STARTED = "run:started",
  RUN_FINISHED = "run:finished",
  RUN_ERROR = "run:error",
  RUN_INTERRUPTED = "run:interrupted",
  STEP_STARTED = "step:started",
  STEP_FINISHED = "step:finished",
  TEXT_MESSAGE_START = "text_message:start",
  TEXT_MESSAGE_CONTENT = "text_message:content",
  TEXT_MESSAGE_END = "text_message:end",
  REASONING_START = "reasoning:start",
  REASONING_END = "reasoning:end",
  REASONING_MESSAGE_START = "reasoning_message:start",
  REASONING_MESSAGE_CONTENT = "reasoning_message:content",
  REASONING_MESSAGE_END = "reasoning_message:end",
  TOOL_CALL_START = "tool_call:start",
  TOOL_CALL_ARGS = "tool_call:args",
  TOOL_CALL_END = "tool_call:end",
  TOOL_CALL_RESULT = "tool_call:result",
  MESSAGES_SNAPSHOT = "messages:snapshot",
  STATE_SNAPSHOT = "state:snapshot",
  STATE_DELTA = "state:delta",
}

/**
 * Base AG-UI event
 */
export interface BaseAgUiEvent {
  type: EventType;
  runId: string;
  threadId?: string;
  timestamp: string;
}

/**
 * Run started event
 */
export interface RunStartedEvent extends BaseAgUiEvent {
  type: EventType.RUN_STARTED;
  inputs?: Record<string, unknown>;
  parentRunId?: string;
}

/**
 * Run finished event
 */
export interface RunFinishedEvent extends BaseAgUiEvent {
  type: EventType.RUN_FINISHED;
  outcome: {
    type: "success" | "failure" | "interrupted" | "interrupt";
  };
  usage?: unknown;
}

/**
 * Step started event
 */
export interface StepStartedEvent extends BaseAgUiEvent {
  type: EventType.STEP_STARTED;
  stepIndex: number;
}

/**
 * Step finished event
 */
export interface StepFinishedEvent extends BaseAgUiEvent {
  type: EventType.STEP_FINISHED;
  stepIndex: number;
  outputLength: number;
}

/**
 * Run interrupted event
 */
export interface RunInterruptedEvent extends BaseAgUiEvent {
  type: EventType.RUN_INTERRUPTED;
  reason?: string;
  message?: string;
  interrupts?: {
    id: string;
    reason: string;
    options?: {
      message?: string;
    };
  }[];
}

/**
 * Run error event
 */
export interface RunErrorEvent extends BaseAgUiEvent {
  type: EventType.RUN_ERROR;
  error: { message: string; code?: string };
}

/**
 * Text message content event
 */
export interface TextMessageContentEvent extends BaseAgUiEvent {
  type: EventType.TEXT_MESSAGE_CONTENT;
  messageId: string;
  content: string;
}

/**
 * Reasoning start event
 */
export interface ReasoningStartEvent extends BaseAgUiEvent {
  type: EventType.REASONING_START;
  messageId?: string;
}

/**
 * Reasoning end event
 */
export interface ReasoningEndEvent extends BaseAgUiEvent {
  type: EventType.REASONING_END;
  messageId?: string;
}

/**
 * Reasoning message start event
 */
export interface ReasoningMessageStartEvent extends BaseAgUiEvent {
  type: EventType.REASONING_MESSAGE_START;
  messageId: string;
}

/**
 * Reasoning message content event
 */
export interface ReasoningMessageContentEvent extends BaseAgUiEvent {
  type: EventType.REASONING_MESSAGE_CONTENT;
  messageId: string;
  content: string;
  encryptedValue?: string;
}

/**
 * Reasoning message end event
 */
export interface ReasoningMessageEndEvent extends BaseAgUiEvent {
  type: EventType.REASONING_MESSAGE_END;
  messageId: string;
}

/**
 * Tool call start event
 */
export interface ToolCallStartEvent extends BaseAgUiEvent {
  type: EventType.TOOL_CALL_START;
  toolCallId: string;
  toolName: string;
}

/**
 * Tool call arguments event
 */
export interface ToolCallArgsEvent extends BaseAgUiEvent {
  type: EventType.TOOL_CALL_ARGS;
  toolCallId: string;
  args: string | Record<string, unknown>;
}

/**
 * Tool call end event
 */
export interface ToolCallEndEvent extends BaseAgUiEvent {
  type: EventType.TOOL_CALL_END;
  toolCallId: string;
  output?: string;
}

/**
 * State snapshot event
 */
export interface StateSnapshotEvent extends BaseAgUiEvent {
  type: EventType.STATE_SNAPSHOT;
  state: Record<string, unknown>;
}

/**
 * State delta event
 */
export interface StateDeltaEvent extends BaseAgUiEvent {
  type: EventType.STATE_DELTA;
  delta: JsonPatchOperation[];
}

/**
 * Simplified JSON Patch operation for AG-UI state synchronization.
 */
export interface JsonPatchOperation {
  op: "add" | "remove" | "replace" | "move" | "copy" | "test";
  path: string;
  value?: unknown;
  from?: string;
}

/**
 * Union of all AG-UI protocol events.
 */
export type AgUiEvent =
  | RunStartedEvent
  | RunFinishedEvent
  | RunErrorEvent
  | RunInterruptedEvent
  | TextMessageContentEvent
  | ReasoningStartEvent
  | ReasoningEndEvent
  | ReasoningMessageStartEvent
  | ReasoningMessageContentEvent
  | ReasoningMessageEndEvent
  | ToolCallStartEvent
  | ToolCallArgsEvent
  | ToolCallEndEvent
  | StepStartedEvent
  | StepFinishedEvent
  | StateSnapshotEvent
  | StateDeltaEvent;
