import type { UsageInfo } from '@agentsy/types';
import type { FinishReason, ToolCallState } from '@agentsy/types';

/**
 * Represents a single UI message in a conversation.
 * Messages are immutable and events are applied to create new states.
 */
export interface UIMessage {
  /** Unique message identifier. */
  id: string;

  /** Message role: 'user' or 'assistant'. */
  role: 'user' | 'assistant';

  /** Message parts (text, thinking, tool calls). */
  parts: UIMessagePart[];

  /** Finish reason if assistant message. */
  finishReason?: FinishReason;

  /** Token usage if assistant message. */
  usage?: UsageInfo;

  /** Timestamp when message was created. */
  createdAt: Date;

  /** Metadata: custom key-value pairs. */
  metadata?: Record<string, unknown>;
}

/**
 * Union type for all possible message parts.
 */
export type UIMessagePart = UITextPart | UIThinkingPart | UIToolCallPart | UIStepPart | UIErrorPart;

/**
 * Message part types without createdAt (for event handlers that auto-add timestamps).
 * @internal
 */
export type UIMessagePartWithoutCreatedAt =
  | Omit<UITextPart, 'createdAt'>
  | Omit<UIThinkingPart, 'createdAt'>
  | Omit<UIToolCallPart, 'createdAt'>
  | Omit<UIStepPart, 'createdAt'>
  | Omit<UIErrorPart, 'createdAt'>;

/**
 * Text content part.
 */
export interface UITextPart {
  type: 'text';
  text: string;
  createdAt: Date;
}

/**
 * Thinking block part (Claude model internals).
 */
export interface UIThinkingPart {
  type: 'thinking';
  text: string;
  createdAt: Date;
}

/**
 * Tool call part (function invocation).
 */
export interface UIToolCallPart {
  type: 'tool_call';
  id: string;
  name: string;
  parameters: Record<string, unknown>;
  state: ToolCallState;
  argumentsText?: string;
  result?: unknown;
  error?: string;
  createdAt: Date;
}

/**
 * Step lifecycle marker for agent-loop aware UIs.
 */
export interface UIStepPart {
  type: 'step';
  stepIndex: number;
  status: 'started' | 'finished';
  usage?: UsageInfo;
  createdAt: Date;
}

/**
 * Error part associated with a message.
 */
export interface UIErrorPart {
  type: 'error';
  message: string;
  code?: string;
  createdAt: Date;
}

/**
 * Complete conversation state (read-only).
 */
export interface UIConversation {
  /** Unique conversation identifier. */
  id: string;

  /** All messages in order. */
  messages: UIMessage[];

  /** Current step index in agent loop. */
  stepIndex: number;

  /** Current streaming status for the conversation. */
  status: 'idle' | 'streaming' | 'error';

  /** Last applied event timestamp. */
  lastEventAt: Date;

  /** Total token count across all messages. */
  totalTokens: number;

  /** Aggregated usage across all messages. */
  totalUsage: UsageInfo;

  /** Metadata: custom key-value pairs. */
  metadata: Record<string, unknown> | undefined;
}

/**
 * Events that drive conversation state transitions.
 */
export type ConversationEvent =
  | { type: 'message_started'; role: 'user' | 'assistant'; messageId: string }
  | { type: 'text_part_added'; messageId: string; text: string }
  | { type: 'thinking_part_added'; messageId: string; text: string }
  | {
      type: 'tool_call_part_added';
      messageId: string;
      toolCall: {
        id: string;
        name: string;
        parameters: Record<string, unknown>;
        state?: ToolCallState;
        argumentsText?: string;
      };
    }
  | {
      type: 'tool_call_updated';
      messageId: string;
      toolCallId: string;
      state?: ToolCallState;
      argumentsTextDelta?: string;
      parameters?: Record<string, unknown>;
    }
  | { type: 'tool_call_result_added'; messageId: string; toolCallId: string; result: unknown; isError?: boolean }
  | { type: 'message_finished'; messageId: string; finishReason?: FinishReason; usage?: UsageInfo }
  | { type: 'step_started'; stepIndex: number; messageId?: string; usage?: UsageInfo }
  | { type: 'step_finished'; stepIndex: number; messageId?: string; usage?: UsageInfo }
  | { type: 'step_updated'; stepIndex: number }
  | { type: 'error_part_added'; messageId: string; message: string; code?: string }
  | { type: 'conversation_reset' };
