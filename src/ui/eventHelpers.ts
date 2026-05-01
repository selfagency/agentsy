import type { UIConversation, UIMessage, UIMessagePart, UIMessagePartWithoutCreatedAt } from './types.js';

/**
 * Helper to reduce duplication in event handlers that add parts to messages.
 * Finds message by ID and appends a new part to it. Automatically adds createdAt.
 *
 * @internal
 */
export function addPartToMessage(state: UIConversation, messageId: string, part: UIMessagePartWithoutCreatedAt): UIConversation {
  const now = new Date();

  const messages = state.messages.map(msg => {
    if (msg.id === messageId) {
      return {
        ...msg,
        parts: [...msg.parts, { ...part, createdAt: now } as UIMessagePart],
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

/**
 * Helper to update message finish state (finishReason, usage, token accumulation).
 * @internal
 */
export function finishMessage(
  state: UIConversation,
  messageId: string,
  finishReason: string | undefined,
  usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | undefined,
): UIConversation {
  const now = new Date();
  let totalTokens = state.totalTokens;

  const messages = state.messages.map(msg => {
    if (msg.id === messageId) {
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
