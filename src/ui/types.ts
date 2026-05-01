import type { FinishReason } from '../tool-calls/types.js';
import type { UsageInfo } from '../normalizers/types.js';

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
export type UIMessagePart = UITextPart | UIThinkingPart | UIToolCallPart;

/**
 * Message part types without createdAt (for event handlers that auto-add timestamps).
 * @internal
 */
export type UIMessagePartWithoutCreatedAt = 
  | Omit<UITextPart, 'createdAt'>
  | Omit<UIThinkingPart, 'createdAt'>
  | Omit<UIToolCallPart, 'createdAt'>;

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

  /** Last applied event timestamp. */
  lastEventAt: Date;

  /** Total token count across all messages. */
  totalTokens: number;

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
      toolCall: { id: string; name: string; parameters: Record<string, unknown> };
    }
  | { type: 'message_finished'; messageId: string; finishReason?: FinishReason; usage?: UsageInfo }
  | { type: 'step_updated'; stepIndex: number }
  | { type: 'conversation_reset' };
