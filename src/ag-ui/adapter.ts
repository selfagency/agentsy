/**
 * AG-UI Stream Adapter
 *
 * Translates llm-stream-parser's PipelineEvent stream into AG-UI-compatible events.
 * This allows any LLM provider (OpenAI, Anthropic, Gemini, etc.) to output AG-UI events
 * for consumption by any AG-UI frontend (CopilotKit, custom, etc.).
 */

import type {
  AgUiEvent,
  ReasoningEndEvent,
  ReasoningMessageContentEvent,
  ReasoningMessageEndEvent,
  ReasoningMessageStartEvent,
  ReasoningStartEvent,
  RunErrorEvent,
  RunFinishedEvent,
  RunStartedEvent,
  TextMessageContentEvent,
  ToolCallArgsEvent,
  ToolCallEndEvent,
  ToolCallStartEvent,
} from './types.js';
import { EventType } from './types.js';

/**
 * Represents events from createPipeline.
 * See src/pipeline/createPipeline.ts for full definition.
 */
export interface PipelineEvent {
  type: 'delta' | 'thinking' | 'tool_call' | 'message_done' | 'error';
  content?: string;
  toolCallId?: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolArgsJson?: string;
  reasoning?: string;
  message?: string;
  code?: string;
  usage?: { inputTokens?: number; outputTokens?: number };
  [key: string]: unknown;
}

export interface AdapterOptions {
  /**
   * Unique identifier for this run (e.g., UUID).
   */
  runId: string;

  /**
   * Thread ID for this conversation (optional).
   */
  threadId?: string;

  /**
   * Parent run ID for hierarchical multi-turn workflows (optional).
   */
  parentRunId?: string;

  /**
   * Emit the REASONING_ENCRYPTED_VALUE placeholder (default: false).
   */
  encryptReasoning?: boolean;
}

/**
 * Creates a unique message ID for tracking separate message streams.
 */
function generateMessageId(): string {
  return `msg_${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Enriches an event object with optional threadId.
 */
function enrichEvent<T extends Record<string, any>>(event: T, threadId: string | undefined): T {
  if (threadId === undefined) return event;
  return { ...event, threadId } as T;
}

/**
 * Handles delta (text content) events.
 */
async function* handleDelta(
  event: PipelineEvent,
  runId: string,
  currentTextMessageId: string,
  threadId: string | undefined,
): AsyncGenerator<AgUiEvent> {
  if (event.content) {
    const textEventBase = {
      type: EventType.TEXT_MESSAGE_CONTENT as const,
      runId,
      messageId: currentTextMessageId,
      content: event.content,
      timestamp: new Date().toISOString(),
    };
    yield enrichEvent(textEventBase, threadId) as TextMessageContentEvent;
  }
}

/**
 * Handles thinking (reasoning) events and state management.
 */
async function* handleThinking(
  event: PipelineEvent,
  runId: string,
  threadId: string | undefined,
  encryptReasoning: boolean,
  inReasoning: { value: boolean },
  currentReasoningMessageId: { value: string | null },
): AsyncGenerator<AgUiEvent> {
  if (!inReasoning.value) {
    currentReasoningMessageId.value = generateMessageId();
    inReasoning.value = true;

    const reasoningStartBase = {
      type: EventType.REASONING_START as const,
      runId,
      messageId: currentReasoningMessageId.value,
      timestamp: new Date().toISOString(),
    };
    yield enrichEvent(reasoningStartBase, threadId) as ReasoningStartEvent;

    const msgStartBase = {
      type: EventType.REASONING_MESSAGE_START as const,
      runId,
      messageId: currentReasoningMessageId.value,
      timestamp: new Date().toISOString(),
    };
    yield enrichEvent(msgStartBase, threadId) as ReasoningMessageStartEvent;
  }

  if (event.content && currentReasoningMessageId.value) {
    const contentEventBase = {
      type: EventType.REASONING_MESSAGE_CONTENT as const,
      runId,
      messageId: currentReasoningMessageId.value,
      content: event.content,
      ...(encryptReasoning && { encryptedValue: 'encrypted' }),
      timestamp: new Date().toISOString(),
    };
    yield enrichEvent(contentEventBase, threadId) as ReasoningMessageContentEvent;
  }
}

/**
 * Closes open reasoning and tool call sessions.
 */
async function* closeOpenSessions(
  runId: string,
  threadId: string | undefined,
  inReasoning: { value: boolean },
  currentReasoningMessageId: { value: string | null },
  currentToolCallId: { value: string | null },
): AsyncGenerator<AgUiEvent> {
  if (inReasoning.value && currentReasoningMessageId.value) {
    const msgEndBase = {
      type: EventType.REASONING_MESSAGE_END as const,
      runId,
      messageId: currentReasoningMessageId.value,
      timestamp: new Date().toISOString(),
    };
    yield enrichEvent(msgEndBase, threadId) as ReasoningMessageEndEvent;

    const reasoningEndBase = {
      type: EventType.REASONING_END as const,
      runId,
      messageId: currentReasoningMessageId.value,
      timestamp: new Date().toISOString(),
    };
    yield enrichEvent(reasoningEndBase, threadId) as ReasoningEndEvent;

    inReasoning.value = false;
    currentReasoningMessageId.value = null;
  }

  if (currentToolCallId.value) {
    const toolEndBase = {
      type: EventType.TOOL_CALL_END as const,
      runId,
      toolCallId: currentToolCallId.value,
      timestamp: new Date().toISOString(),
    };
    yield enrichEvent(toolEndBase, threadId) as ToolCallEndEvent;
    currentToolCallId.value = null;
  }
}

/**
 * Handles tool_call events.
 */
async function* handleToolCall(
  event: PipelineEvent,
  runId: string,
  threadId: string | undefined,
  inReasoning: { value: boolean },
  currentReasoningMessageId: { value: string | null },
  currentToolCallId: { value: string | null },
): AsyncGenerator<AgUiEvent> {
  // Transition to a new tool call
  if (currentToolCallId.value !== event.toolCallId && event.toolCallId) {
    // Close the previous tool call if one is open
    yield* closeOpenSessions(runId, threadId, inReasoning, currentReasoningMessageId, {
      value: currentToolCallId.value,
    });

    // Start the new tool call
    currentToolCallId.value = event.toolCallId;
    const toolStartBase = {
      type: EventType.TOOL_CALL_START as const,
      runId,
      toolCallId: currentToolCallId.value,
      toolName: event.toolName || 'unknown',
      timestamp: new Date().toISOString(),
    };
    yield enrichEvent(toolStartBase, threadId) as ToolCallStartEvent;
  }

  // Emit arguments if provided
  if (currentToolCallId.value && event.toolArgs) {
    const toolArgsBase = {
      type: EventType.TOOL_CALL_ARGS as const,
      runId,
      toolCallId: currentToolCallId.value,
      args: event.toolArgs,
      timestamp: new Date().toISOString(),
    };
    yield enrichEvent(toolArgsBase, threadId) as ToolCallArgsEvent;
  }
}

/**
 * Handles message_done events.
 */
async function* handleMessageDone(
  event: PipelineEvent,
  runId: string,
  threadId: string | undefined,
  inReasoning: { value: boolean },
  currentReasoningMessageId: { value: string | null },
  currentToolCallId: { value: string | null },
): AsyncGenerator<AgUiEvent> {
  yield* closeOpenSessions(runId, threadId, inReasoning, currentReasoningMessageId, currentToolCallId);

  const runFinishedBase = {
    type: EventType.RUN_FINISHED as const,
    runId,
    outcome: { type: 'success' as const },
    timestamp: new Date().toISOString(),
    ...(event.usage && { usage: event.usage }),
  };
  yield enrichEvent(runFinishedBase, threadId) as RunFinishedEvent;
}

/**
 * Handles error events.
 */
async function* handleError(
  event: PipelineEvent,
  runId: string,
  threadId: string | undefined,
  inReasoning: { value: boolean },
  currentReasoningMessageId: { value: string | null },
  currentToolCallId: { value: string | null },
): AsyncGenerator<AgUiEvent> {
  yield* closeOpenSessions(runId, threadId, inReasoning, currentReasoningMessageId, currentToolCallId);

  const runErrorBase = {
    type: EventType.RUN_ERROR as const,
    runId,
    error: {
      message: event.message || 'Unknown error',
      ...(event.code && { code: event.code }),
    },
    timestamp: new Date().toISOString(),
  };
  yield enrichEvent(runErrorBase, threadId) as RunErrorEvent;
}

/**
 * Converts an AsyncGenerator of PipelineEvents into an AsyncGenerator of AG-UI events.
 *
 * @param source - Stream of pipeline events
 * @param options - Configuration (runId required, threadId/parentRunId optional)
 * @returns AsyncGenerator emitting AG-UI events
 */
export async function* toAgUiStream(
  source: AsyncGenerator<PipelineEvent>,
  options: AdapterOptions,
): AsyncGenerator<AgUiEvent> {
  const { runId, threadId, parentRunId, encryptReasoning } = options;

  // Initialize message tracking - use mutable refs for state
  let currentTextMessageId = generateMessageId();
  const inReasoning = { value: false };
  const currentReasoningMessageId = { value: null as string | null };
  const currentToolCallId = { value: null as string | null };

  // Emit RUN_STARTED
  const runStartedBase = {
    type: EventType.RUN_STARTED as const,
    runId,
    timestamp: new Date().toISOString(),
  };
  const runStarted = enrichEvent(runStartedBase, threadId);
  if (parentRunId) {
    yield { ...runStarted, parentRunId } as RunStartedEvent;
  } else {
    yield runStarted as RunStartedEvent;
  }

  try {
    for await (const event of source) {
      switch (event.type) {
        case 'delta':
          yield* handleDelta(event, runId, currentTextMessageId, threadId);
          break;

        case 'thinking':
          yield* handleThinking(
            event,
            runId,
            threadId,
            encryptReasoning || false,
            inReasoning,
            currentReasoningMessageId,
          );
          break;

        case 'tool_call':
          yield* handleToolCall(event, runId, threadId, inReasoning, currentReasoningMessageId, currentToolCallId);
          break;

        case 'message_done': {
          yield* handleMessageDone(event, runId, threadId, inReasoning, currentReasoningMessageId, currentToolCallId);
          currentTextMessageId = generateMessageId();
          break;
        }

        case 'error':
          yield* handleError(event, runId, threadId, inReasoning, currentReasoningMessageId, currentToolCallId);
          break;
      }
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown stream error';
    const runErrorBase = {
      type: EventType.RUN_ERROR as const,
      runId,
      error: {
        message: errorMessage,
      },
      timestamp: new Date().toISOString(),
    };
    yield enrichEvent(runErrorBase, threadId) as RunErrorEvent;
  }
}
