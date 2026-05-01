import { applyConversationEvent } from './eventSourcing.js';
import type { ConversationEvent, UIConversation } from './types.js';

/**
 * Listener callback type for store changes.
 */
export type StoreListener = (state: UIConversation) => void;

/**
 * Reactive store for conversation state with event sourcing.
 * State is immutable; listeners are notified on every event.
 */
export interface ConversationStore {
  /** Get current conversation state. */
  getState(): UIConversation;

  /** Apply event to store (synchronously updates state, notifies listeners). */
  dispatch(event: ConversationEvent): void;

  /** Subscribe to state changes. Returns unsubscribe function. */
  subscribe(listener: StoreListener): () => void;

  /** Get all events applied since store creation (for debugging/audit). */
  getEventLog(): ConversationEvent[];
}

/**
 * Create a new conversation store with initial empty state.
 *
 * @param conversationId - Unique identifier for this conversation
 * @returns A ConversationStore instance
 *
 * @example
 * ```typescript
 * const store = createConversationStore('conv-123');
 *
 * // Subscribe to changes
 * const unsubscribe = store.subscribe((state) => {
 *   console.log('New state:', state);
 * });
 *
 * // Dispatch events
 * store.dispatch({
 *   type: 'message_started',
 *   role: 'user',
 *   messageId: 'msg-1',
 * });
 *
 * store.dispatch({
 *   type: 'text_part_added',
 *   messageId: 'msg-1',
 *   text: 'Hello!',
 * });
 *
 * // Unsubscribe when done
 * unsubscribe();
 * ```
 */
export function createConversationStore(conversationId: string): ConversationStore {
  let state: UIConversation = {
    id: conversationId,
    messages: [],
    stepIndex: 0,
    lastEventAt: new Date(),
    totalTokens: 0,
    metadata: undefined,
  };

  const listeners = new Set<StoreListener>();
  const eventLog: ConversationEvent[] = [];

  const notifyListeners = () => {
    for (const listener of listeners) {
      listener(state);
    }
  };

  return {
    getState(): UIConversation {
      // Return a shallow copy to prevent external mutations
      return {
        ...state,
        messages: [...state.messages],
      };
    },

    dispatch(event: ConversationEvent): void {
      // Apply event to state
      state = applyConversationEvent(state, event);

      // Log event for audit trail
      eventLog.push(event);

      // Notify all listeners
      notifyListeners();
    },

    subscribe(listener: StoreListener): () => void {
      listeners.add(listener);

      // Return unsubscribe function
      return () => {
        listeners.delete(listener);
      };
    },

    getEventLog(): ConversationEvent[] {
      // Return copy of event log
      return [...eventLog];
    },
  };
}
