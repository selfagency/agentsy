import { reduceSessionState, type SessionAction } from './state/reducers.js';
import { createSessionState, type SessionState, SessionStateSchema } from './state/schema.js';
import type { SessionStore } from './store.js';

// ---------------------------------------------------------------------------
// SessionManager
// ---------------------------------------------------------------------------

export interface SessionManagerOptions {
  /** Parent session ID if this is a forked session. */
  parentSessionId?: string;
  /** Parent thread ID if this is a forked session. */
  parentThreadId?: string;
  /** Session ID to manage (auto-generated if omitted). */
  sessionId?: string;
  /** Thread ID to manage (auto-generated if omitted). */
  threadId?: string;
}

export interface CheckpointInfo {
  id: string;
  label?: string;
  timestamp: number;
}

export interface SessionManager {
  /** Apply a session action (immutable reducer), persist the new state. */
  apply(action: SessionAction): Readonly<SessionState>;

  /** Remove a checkpoint. */
  clearCheckpoint(id: string): void;

  /** Fork this session into a new child session. Returns the child manager. */
  fork(parentStoreFactory?: () => SessionStore): SessionManager;

  /** List all saved checkpoints with metadata. */
  getCheckpoints(): CheckpointInfo[];
  /** Return a snapshot of the current session state. */
  getState(): Readonly<SessionState>;

  /** Load a previous session state from a checkpoint id. Returns null if not found. */
  loadCheckpoint(id: string): Readonly<SessionState> | null;

  /** Persist the entire session state to the underlying store. */
  persist(): void;

  /** Restore session state from a checkpoint and return the manager at that state. */
  restoreCheckpoint(id: string): SessionManager;

  /** Save a named checkpoint at the current state. Returns the checkpoint id. */
  saveCheckpoint(label?: string): string;
}

let _checkpointSeq = 0;
function nextCheckpointId(): string {
  _checkpointSeq++;
  return `cp_${Date.now()}_${_checkpointSeq}`;
}

let _sessionSeq = 0;
function nextSessionId(): string {
  _sessionSeq++;
  return `ses_${Date.now()}_${_sessionSeq}`;
}

const CHECKPOINT_LIST_KEY = 'session_checkpoints';
const STATE_KEY = 'session_state';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a new SessionManager backed by the given SessionStore.
 *
 * The manager reads/writes the session state and checkpoints through the
 * store, providing typed, reducer-based state management on top of the
 * raw key-value persistence.
 */
export function createSessionManager(store: SessionStore, options?: SessionManagerOptions): SessionManager {
  const sessionId = options?.sessionId ?? nextSessionId();
  const threadId = options?.threadId ?? nextSessionId();

  // Initialise state from store or create fresh
  let currentState = hydrateState(store);
  if (!currentState) {
    currentState = createSessionState(sessionId, threadId);
    if (options?.parentSessionId) {
      currentState = { ...currentState, parentSessionId: options.parentSessionId };
    }
    if (options?.parentThreadId) {
      currentState = { ...currentState, parentThreadId: options.parentThreadId };
    }
    store.setValue(STATE_KEY, currentState);
  }

  // ------------------------------------------------------------------
  // Internal helpers
  // ------------------------------------------------------------------

  function hydrateState(s: SessionStore): SessionState | null {
    const raw = s.getValue(STATE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = SessionStateSchema.safeParse(raw);
    if (!parsed.success) {
      return null;
    }
    return parsed.data;
  }

  function saveState(s: SessionState): void {
    store.setValue(STATE_KEY, s);
    currentState = s;
  }

  function readCheckpointList(): CheckpointInfo[] {
    const raw = store.getValue(CHECKPOINT_LIST_KEY);
    if (!raw) {
      return [];
    }
    if (Array.isArray(raw)) {
      return raw as CheckpointInfo[];
    }
    return [];
  }

  function writeCheckpointList(list: CheckpointInfo[]): void {
    store.setValue(CHECKPOINT_LIST_KEY, list);
  }

  // ------------------------------------------------------------------
  // Manager methods
  // ------------------------------------------------------------------

  return {
    getState(): Readonly<SessionState> {
      return currentState;
    },

    apply(action: SessionAction): Readonly<SessionState> {
      const next = reduceSessionState(currentState, action);
      saveState(next);
      return next;
    },

    fork(parentStoreFactory?: () => SessionStore): SessionManager {
      const childStore = parentStoreFactory?.() ?? store;
      const forked = reduceSessionState(currentState, {
        type: 'forkSession',
        newSessionId: nextSessionId(),
        newThreadId: nextSessionId()
      });
      childStore.setValue(STATE_KEY, forked);
      return createSessionManager(childStore, {
        sessionId: forked.sessionId,
        threadId: forked.threadId,
        parentSessionId: forked.parentSessionId,
        parentThreadId: forked.parentThreadId
      });
    },

    saveCheckpoint(label?: string): string {
      const id = nextCheckpointId();
      const timestamp = Date.now();
      const checkpointKey = `checkpoint:${id}`;
      store.setValue(checkpointKey, currentState);
      const list = readCheckpointList();
      list.push({ id, timestamp, ...(label ? { label } : {}) });
      writeCheckpointList(list);
      return id;
    },

    loadCheckpoint(id: string): Readonly<SessionState> | null {
      const raw = store.getValue(`checkpoint:${id}`);
      if (!raw) {
        return null;
      }
      const parsed = SessionStateSchema.safeParse(raw);
      if (!parsed.success) {
        return null;
      }
      return parsed.data;
    },

    clearCheckpoint(id: string): void {
      store.removeValue(`checkpoint:${id}`);
      const list = readCheckpointList().filter(c => c.id !== id);
      writeCheckpointList(list);
    },

    getCheckpoints(): CheckpointInfo[] {
      return readCheckpointList();
    },

    restoreCheckpoint(id: string): SessionManager {
      const state = this.loadCheckpoint(id);
      if (!state) {
        throw new Error(`Checkpoint not found: ${id}`);
      }
      saveState(state);
      return createSessionManager(store, {
        sessionId: state.sessionId,
        threadId: state.threadId,
        parentSessionId: state.parentSessionId,
        parentThreadId: state.parentThreadId
      });
    },

    persist(): void {
      store.setValue(STATE_KEY, currentState);
    }
  };
}
