/**
 * Immutable reducer functions for typed session state.
 *
 * Each reducer takes a {@link SessionState} and returns a **new** copy with
 * the requested mutation applied — they never mutate the original.
 */

import type { Checkpoint, ContentPart, Message, SessionState, ToolCall } from './schema.js';

// ---------------------------------------------------------------------------
// Reducer action types
// ---------------------------------------------------------------------------

export type { SessionState } from './schema.js';

export type ReducerAction =
  | AppendMessageAction
  | UpdateMessageAction
  | ReplaceMessagesAction
  | TruncateMessagesAction
  | AddToolCallAction
  | UpdateToolCallAction
  | AddCheckpointAction
  | SetMetaAction
  | PinMessageAction
  | UnpinMessageAction
  | ForkSessionAction
  | UpdateTimestampsAction;

export interface AppendMessageAction {
  message: Message;
  type: 'appendMessage';
}

export interface UpdateMessageAction {
  index: number;
  message: Partial<Message>;
  type: 'updateMessage';
}

export interface ReplaceMessagesAction {
  messages: Message[];
  type: 'replaceMessages';
}

export interface TruncateMessagesAction {
  keepCount: number;
  type: 'truncateMessages';
}

export interface AddToolCallAction {
  toolCall: ToolCall;
  type: 'addToolCall';
}

export interface UpdateToolCallAction {
  id: string;
  updates: Partial<ToolCall>;
  type: 'updateToolCall';
}

export interface AddCheckpointAction {
  checkpoint: Checkpoint;
  type: 'addCheckpoint';
}

export interface SetMetaAction {
  key: string;
  value: unknown;
  type: 'setMeta';
}

export interface PinMessageAction {
  messageId: string;
  type: 'pinMessage';
}

export interface UnpinMessageAction {
  messageId: string;
  type: 'unpinMessage';
}

export interface ForkSessionAction {
  branchMeta: {
    parentSessionId: string;
    parentThreadId: string;
    forkReason?: string;
  };
  newSessionId: string;
  newThreadId: string;
  type: 'forkSession';
}

export interface UpdateTimestampsAction {
  type: 'updateTimestamps';
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

/**
 * Pure reducer that applies an action to session state immutably.
 *
 * @param state — Current session state.
 * @param action — Action to apply.
 * @returns A new session state with the mutation applied.
 */
export function reduceSessionState(state: SessionState, action: ReducerAction): SessionState {
  const now = Date.now();

  switch (action.type) {
    // ---- Messages ---------------------------------------------------------
    case 'appendMessage': {
      return {
        ...state,
        messages: [...state.messages, action.message],
        updatedAt: now
      };
    }

    case 'updateMessage': {
      const messages = [...state.messages];
      const existing = messages[action.index];
      if (existing === undefined) {
        return { ...state, updatedAt: now };
      }
      messages[action.index] = { ...existing, ...action.message } as Message;
      return { ...state, messages, updatedAt: now };
    }

    case 'replaceMessages': {
      return { ...state, messages: [...action.messages], updatedAt: now };
    }

    case 'truncateMessages': {
      return {
        ...state,
        messages: state.messages.slice(0, action.keepCount),
        updatedAt: now
      };
    }

    // ---- Tool calls -------------------------------------------------------
    case 'addToolCall': {
      return {
        ...state,
        toolCallQueue: [...state.toolCallQueue, action.toolCall],
        updatedAt: now
      };
    }

    case 'updateToolCall': {
      return {
        ...state,
        toolCallQueue: state.toolCallQueue.map(tc =>
          tc.id === action.id ? ({ ...tc, ...action.updates } as ToolCall) : tc
        ),
        updatedAt: now
      };
    }

    // ---- Checkpoints ------------------------------------------------------
    case 'addCheckpoint': {
      return {
        ...state,
        checkpoints: [...state.checkpoints, action.checkpoint],
        updatedAt: now
      };
    }

    // ---- Meta -------------------------------------------------------------
    case 'setMeta': {
      return {
        ...state,
        meta: { ...state.meta, [action.key]: action.value },
        updatedAt: now
      };
    }

    // ---- Pins -------------------------------------------------------------
    case 'pinMessage': {
      const pinned = state.pinnedMessageIds ?? [];
      if (pinned.includes(action.messageId)) {
        return state;
      }
      return {
        ...state,
        pinnedMessageIds: [...pinned, action.messageId],
        updatedAt: now
      };
    }

    case 'unpinMessage': {
      const current = state.pinnedMessageIds;
      if (current === undefined) {
        return state;
      }
      return {
        ...state,
        pinnedMessageIds: current.filter(id => id !== action.messageId),
        updatedAt: now
      };
    }

    // ---- Branching --------------------------------------------------------
    case 'forkSession': {
      return {
        ...state,
        sessionId: action.newSessionId,
        threadId: action.newThreadId,
        parentSessionId: state.sessionId,
        parentThreadId: state.threadId,
        branchMeta: {
          parentSessionId: state.sessionId,
          parentThreadId: state.threadId,
          forkedAt: now,
          forkReason: action.branchMeta.forkReason
        },
        updatedAt: now
      };
    }

    // ---- Timestamps -------------------------------------------------------
    case 'updateTimestamps': {
      return { ...state, updatedAt: now };
    }

    default: {
      action satisfies never;
      return state;
    }
  }
}
