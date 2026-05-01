import { addPartToMessage, finishMessage } from './eventHelpers.js';
import type { ConversationEvent, UIConversation, UIMessage } from './types.js';

/**
 * Handle message_started event: create new message.
 * @internal
 */
function handleMessageStarted(state: UIConversation, messageId: string, role: string, now: Date): UIConversation {
  const newMessage: UIMessage = {
    id: messageId,
    role: role as 'user' | 'assistant',
    parts: [],
    createdAt: now,
  };

  return {
    ...state,
    messages: [...state.messages, newMessage],
    lastEventAt: now,
  };
}

/**
 * Handle step_updated event: update current step index.
 * @internal
 */
function handleStepUpdated(state: UIConversation, stepIndex: number, now: Date): UIConversation {
  return {
    ...state,
    stepIndex,
    lastEventAt: now,
  };
}

/**
 * Handle conversation_reset event: reset to empty conversation.
 * @internal
 */
function handleConversationReset(state: UIConversation, now: Date): UIConversation {
  return {
    id: state.id,
    messages: [],
    stepIndex: 0,
    lastEventAt: now,
    totalTokens: 0,
    metadata: undefined,
  };
}

/**
 * Pure function: Apply a single event to conversation state, returning new state.
 * Original state is never mutated.
 *
 * @param state - Current conversation state
 * @param event - Event to apply
 * @returns New conversation state with event applied
 */
export function applyConversationEvent(state: UIConversation, event: ConversationEvent): UIConversation {
  const now = new Date();

  switch (event.type) {
    case 'message_started': {
      return handleMessageStarted(state, event.messageId, event.role, now);
    }

    case 'text_part_added': {
      return addPartToMessage(state, event.messageId, {
        type: 'text',
        text: event.text,
      } as const);
    }

    case 'thinking_part_added': {
      return addPartToMessage(state, event.messageId, {
        type: 'thinking',
        text: event.text,
      } as const);
    }

    case 'tool_call_part_added': {
      return addPartToMessage(state, event.messageId, {
        type: 'tool_call',
        id: event.toolCall.id,
        name: event.toolCall.name,
        parameters: event.toolCall.parameters,
      } as const);
    }

    case 'message_finished': {
      return finishMessage(state, event.messageId, event.finishReason, event.usage);
    }

    case 'step_updated': {
      return handleStepUpdated(state, event.stepIndex, now);
    }

    case 'conversation_reset': {
      return handleConversationReset(state, now);
    }

    default: {
      // Exhaustiveness check: if we reach here, TypeScript knows event is never
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}
