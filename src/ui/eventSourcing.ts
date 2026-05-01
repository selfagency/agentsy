import type { UIConversation, UIMessage, ConversationEvent } from './types.js';
import { addPartToMessage, finishMessage } from './eventHelpers.js';

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
      // Create new message
      const newMessage: UIMessage = {
        id: event.messageId,
        role: event.role,
        parts: [],
        createdAt: now,
      };

      return {
        ...state,
        messages: [...state.messages, newMessage],
        lastEventAt: now,
      };
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
      return {
        ...state,
        stepIndex: event.stepIndex,
        lastEventAt: now,
      };
    }

    case 'conversation_reset': {
      // Reset to empty conversation
      return {
        id: state.id,
        messages: [],
        stepIndex: 0,
        lastEventAt: now,
        totalTokens: 0,
        metadata: undefined,
      };
    }

    default: {
      // Exhaustiveness check: if we reach here, TypeScript knows event is never
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}
