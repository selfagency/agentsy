/**
 * AG-UI Stream Adapter
 *
 * Translates llm-stream-parser's PipelineEvent stream into AG-UI-compatible events.
 * This allows any LLM provider (OpenAI, Anthropic, Gemini, etc.) to output AG-UI events
 * for consumption by any AG-UI frontend (CopilotKit, custom, etc.).
 */

import type {
  TextMessageContentEvent,
  ReasoningStartEvent,
  ReasoningMessageStartEvent,
  ReasoningMessageContentEvent,
  ReasoningMessageEndEvent,
  ReasoningEndEvent,
  ToolCallStartEvent,
  ToolCallArgsEvent,
  ToolCallEndEvent,
  RunFinishedEvent,
  RunErrorEvent,
  RunStartedEvent,
  AgUiEvent,
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
  toolArgs?: Record<string, any>;
  toolArgsJson?: string;
  reasoning?: string;
  message?: string;
  code?: string;
  usage?: { inputTokens?: number; outputTokens?: number };
  [key: string]: any;
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

  // Initialize message tracking
  let currentTextMessageId = generateMessageId();
  let currentReasoningMessageId: string | null = null;
  let currentToolCallId: string | null = null;
  let inReasoning = false;

  // Emit RUN_STARTED at stream start
  const runStartedBase = {
    type: EventType.RUN_STARTED as const,
    runId,
    timestamp: new Date().toISOString(),
  };
  const runStarted = {
    ...runStartedBase,
    ...(threadId !== undefined && { threadId }),
    ...(parentRunId !== undefined && { parentRunId }),
  } as RunStartedEvent;
  yield runStarted;

  try {
    for await (const event of source) {
      switch (event.type) {
        case 'delta': {
          // Text content - emit within TEXT_MESSAGE envelope
          if (event.content) {
            const textEventBase = {
              type: EventType.TEXT_MESSAGE_CONTENT as const,
              runId,
              messageId: currentTextMessageId,
              content: event.content,
              timestamp: new Date().toISOString(),
            };
            const textEvent = {
              ...textEventBase,
              ...(threadId !== undefined && { threadId }),
            } as TextMessageContentEvent;
            yield textEvent;
          }
          break;
        }

        case 'thinking': {
          // Reasoning content - emit within REASONING_MESSAGE envelope
          if (!inReasoning) {
            currentReasoningMessageId = generateMessageId();
            inReasoning = true;

            // REASONING_START
            const reasoningStartBase = {
              type: EventType.REASONING_START as const,
              runId,
              messageId: currentReasoningMessageId,
              timestamp: new Date().toISOString(),
            };
            const reasoningStart = {
              ...reasoningStartBase,
              ...(threadId !== undefined && { threadId }),
            } as ReasoningStartEvent;
            yield reasoningStart;

            // REASONING_MESSAGE_START
            const msgStartBase = {
              type: EventType.REASONING_MESSAGE_START as const,
              runId,
              messageId: currentReasoningMessageId,
              timestamp: new Date().toISOString(),
            };
            const msgStart = {
              ...msgStartBase,
              ...(threadId !== undefined && { threadId }),
            } as ReasoningMessageStartEvent;
            yield msgStart;
          }

          if (event.content) {
            // REASONING_MESSAGE_CONTENT
            const contentEventBase = {
              type: EventType.REASONING_MESSAGE_CONTENT as const,
              runId,
              messageId: currentReasoningMessageId!,
              content: event.content,
              ...(encryptReasoning && { encryptedValue: 'encrypted' }),
              timestamp: new Date().toISOString(),
            };
            const contentEvent = {
              ...contentEventBase,
              ...(threadId !== undefined && { threadId }),
            } as ReasoningMessageContentEvent;
            yield contentEvent;
          }
          break;
        }

        case 'tool_call': {
          // Tool call - emit START, ARGS, END sequence
          if (!currentToolCallId && event.toolCallId) {
            currentToolCallId = event.toolCallId;

            // Close reasoning if still open
            if (inReasoning && currentReasoningMessageId) {
              const msgEndBase = {
                type: EventType.REASONING_MESSAGE_END as const,
                runId,
                messageId: currentReasoningMessageId,
                timestamp: new Date().toISOString(),
              };
              const msgEnd = {
                ...msgEndBase,
                ...(threadId !== undefined && { threadId }),
              } as ReasoningMessageEndEvent;
              yield msgEnd;

              const reasoningEndBase = {
                type: EventType.REASONING_END as const,
                runId,
                messageId: currentReasoningMessageId,
                timestamp: new Date().toISOString(),
              };
              const reasoningEnd = {
                ...reasoningEndBase,
                ...(threadId !== undefined && { threadId }),
              } as ReasoningEndEvent;
              yield reasoningEnd;

              inReasoning = false;
              currentReasoningMessageId = null;
            }

            // Emit TOOL_CALL_START
            const toolStartBase = {
              type: EventType.TOOL_CALL_START as const,
              runId,
              toolCallId: currentToolCallId,
              toolName: event.toolName || 'unknown',
              timestamp: new Date().toISOString(),
            };
            const toolStart = {
              ...toolStartBase,
              ...(threadId !== undefined && { threadId }),
            } as ToolCallStartEvent;
            yield toolStart;
          }

          // Emit TOOL_CALL_ARGS once we have complete args
          if (currentToolCallId && event.toolArgs) {
            const toolArgsBase = {
              type: EventType.TOOL_CALL_ARGS as const,
              runId,
              toolCallId: currentToolCallId,
              args: event.toolArgs,
              timestamp: new Date().toISOString(),
            };
            const toolArgs = {
              ...toolArgsBase,
              ...(threadId !== undefined && { threadId }),
            } as ToolCallArgsEvent;
            yield toolArgs;
          }

          // Emit TOOL_CALL_END if this was the final chunk
          if (currentToolCallId && (event.content === undefined || event.content === '')) {
            const toolEndBase = {
              type: EventType.TOOL_CALL_END as const,
              runId,
              toolCallId: currentToolCallId,
              timestamp: new Date().toISOString(),
            };
            const toolEnd = {
              ...toolEndBase,
              ...(threadId !== undefined && { threadId }),
            } as ToolCallEndEvent;
            yield toolEnd;

            currentToolCallId = null;
          }
          break;
        }

        case 'message_done': {
          // Close any open reasoning or tool call
          if (inReasoning && currentReasoningMessageId) {
            const msgEndBase = {
              type: EventType.REASONING_MESSAGE_END as const,
              runId,
              messageId: currentReasoningMessageId,
              timestamp: new Date().toISOString(),
            };
            const msgEnd = {
              ...msgEndBase,
              ...(threadId !== undefined && { threadId }),
            } as ReasoningMessageEndEvent;
            yield msgEnd;

            const reasoningEndBase = {
              type: EventType.REASONING_END as const,
              runId,
              messageId: currentReasoningMessageId,
              timestamp: new Date().toISOString(),
            };
            const reasoningEnd = {
              ...reasoningEndBase,
              ...(threadId !== undefined && { threadId }),
            } as ReasoningEndEvent;
            yield reasoningEnd;

            inReasoning = false;
            currentReasoningMessageId = null;
          }

          if (currentToolCallId) {
            const toolEndBase = {
              type: EventType.TOOL_CALL_END as const,
              runId,
              toolCallId: currentToolCallId,
              timestamp: new Date().toISOString(),
            };
            const toolEnd = {
              ...toolEndBase,
              ...(threadId !== undefined && { threadId }),
            } as ToolCallEndEvent;
            yield toolEnd;

            currentToolCallId = null;
          }

          // Emit RUN_FINISHED
          const runFinishedBase = {
            type: EventType.RUN_FINISHED as const,
            runId,
            outcome: { type: 'success' as const },
            timestamp: new Date().toISOString(),
            ...(event.usage && { usage: event.usage }),
          };
          const runFinished = {
            ...runFinishedBase,
            ...(threadId !== undefined && { threadId }),
          } as RunFinishedEvent;
          yield runFinished;

          // Reset for next message
          currentTextMessageId = generateMessageId();
          break;
        }

        case 'error': {
          // Close any open messaging
          if (inReasoning && currentReasoningMessageId) {
            const msgEndBase = {
              type: EventType.REASONING_MESSAGE_END as const,
              runId,
              messageId: currentReasoningMessageId,
              timestamp: new Date().toISOString(),
            };
            const msgEnd = {
              ...msgEndBase,
              ...(threadId !== undefined && { threadId }),
            } as ReasoningMessageEndEvent;
            yield msgEnd;

            const reasoningEndBase = {
              type: EventType.REASONING_END as const,
              runId,
              messageId: currentReasoningMessageId,
              timestamp: new Date().toISOString(),
            };
            const reasoningEnd = {
              ...reasoningEndBase,
              ...(threadId !== undefined && { threadId }),
            } as ReasoningEndEvent;
            yield reasoningEnd;

            inReasoning = false;
          }

          if (currentToolCallId) {
            const toolEndBase = {
              type: EventType.TOOL_CALL_END as const,
              runId,
              toolCallId: currentToolCallId,
              timestamp: new Date().toISOString(),
            };
            const toolEnd = {
              ...toolEndBase,
              ...(threadId !== undefined && { threadId }),
            } as ToolCallEndEvent;
            yield toolEnd;

            currentToolCallId = null;
          }

          // Emit RUN_ERROR
          const runErrorBase = {
            type: EventType.RUN_ERROR as const,
            runId,
            error: {
              message: event.message || 'Unknown error',
              ...(event.code && { code: event.code }),
            },
            timestamp: new Date().toISOString(),
          };
          const runError = {
            ...runErrorBase,
            ...(threadId !== undefined && { threadId }),
          } as RunErrorEvent;
          yield runError;
          break;
        }
      }
    }
  } catch (err) {
    // On any unhandled error, emit RUN_ERROR
    const errorMessage = err instanceof Error ? err.message : 'Unknown stream error';
    const runErrorBase = {
      type: EventType.RUN_ERROR as const,
      runId,
      error: {
        message: errorMessage,
      },
      timestamp: new Date().toISOString(),
    };
    const runError = {
      ...runErrorBase,
      ...(threadId !== undefined && { threadId }),
    } as RunErrorEvent;
    yield runError;
  }
}
