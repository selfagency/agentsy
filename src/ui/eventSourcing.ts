import type { UIConversation, UIMessage, ConversationEvent } from './types.js';

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
      // Find message and append text part
      const messages = state.messages.map(msg => {
        if (msg.id === event.messageId) {
          return {
            ...msg,
            parts: [
              ...msg.parts,
              {
                type: 'text',
                text: event.text,
                createdAt: now,
              } as const,
            ],
          };
        }
        return msg;
      });

      return {
        ...state,
        messages,
        lastEventAt: now,
      };
    }

    case 'thinking_part_added': {
      // Find message and append thinking part
      const messages = state.messages.map(msg => {
        if (msg.id === event.messageId) {
          return {
            ...msg,
            parts: [
              ...msg.parts,
              {
                type: 'thinking',
                text: event.text,
                createdAt: now,
              } as const,
            ],
          };
        }
        return msg;
      });

      return {
        ...state,
        messages,
        lastEventAt: now,
      };
    }

    case 'tool_call_part_added': {
      // Find message and append tool call part
      const messages = state.messages.map(msg => {
        if (msg.id === event.messageId) {
          return {
            ...msg,
            parts: [
              ...msg.parts,
              {
                type: 'tool_call',
                id: event.toolCall.id,
                name: event.toolCall.name,
                parameters: event.toolCall.parameters,
                createdAt: now,
              } as const,
            ],
          };
        }
        return msg;
      });

      return {
        ...state,
        messages,
        lastEventAt: now,
      };
    }

    case 'message_finished': {
      // Find message and set finishReason, usage, calculate tokens
      let totalTokens = state.totalTokens;

      const messages = state.messages.map(msg => {
        if (msg.id === event.messageId) {
          const finishReason = event.finishReason;
          const usage = event.usage;

          // Add usage tokens to total
          if (usage?.totalTokens !== undefined) {
            totalTokens += usage.totalTokens;
          }

          return {
            ...msg,
            finishReason,
            usage,
          };
        }
        return msg;
      });

      return {
        ...state,
        messages: messages as UIMessage[],
        totalTokens,
        lastEventAt: now,
      };
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
