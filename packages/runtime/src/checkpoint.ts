import type { SessionStore } from '@agentsy/types';

/**
 * Serializable runtime state snapshot for mid-run checkpointing.
 *
 * Captures enough state so the runtime loop can restore execution after
 * an interruption, tool boundary, or explicit save point.
 */
export interface RuntimeCheckpoint {
  id: string;
  /** Queue of messages leading up to this point. */
  messageQueue: { role: string; content: string }[];
  /** Arbitrary metadata for extensions (guardrails, memory, etc.). */
  metadata?: Record<string, unknown>;
  /** Ordered list of pending tool calls at the checkpoint moment. */
  pendingToolCalls: { id: string; name: string; args: unknown }[];
  /**
   * Routing metadata for retry/failover continuity.
   * Preserves which replicas and logical models have been attempted
   * so that resumed sessions avoid already-failed replicas.
   */
  routingMetadata?: {
    attemptedReplicaIds: string[];
    attemptedLogicalModelIds: string[];
    currentLogicalModelId?: string;
    currentReplicaId?: string;
    escalationLevel?: number;
  };
  /** Active subagents and their state summaries. */
  subagentStates: { id: string; status: string; result?: unknown }[];
  timestamp: number;
}

let _checkpointCounter = 0;
function nextCheckpointId(): string {
  _checkpointCounter++;
  return `rtchk_${Date.now()}_${_checkpointCounter}`;
}

// codacy:disable security/HardcodedPassword -- Not a password, it's a store key prefix
const CHECKPOINT_KEY = 'runtime_checkpoint';

/**
 * Save a runtime checkpoint to the session store.
 *
 * Called at configurable points during execution (before every tool call,
 * every Nth turn, on explicit request). The checkpoint is overwritten on
 * each call — only the most recent checkpoint is retained.
 *
 * @param state - Current runtime state to persist.
 * @param sessionStore - The session store for persistence.
 * @returns The created `RuntimeCheckpoint` with its id and timestamp.
 */
export function checkpoint(
  state: Omit<RuntimeCheckpoint, 'id' | 'timestamp'>,
  sessionStore: Pick<SessionStore, 'setValue'>
): RuntimeCheckpoint {
  const cp: RuntimeCheckpoint = {
    id: nextCheckpointId(),
    timestamp: Date.now(),
    pendingToolCalls: state.pendingToolCalls,
    messageQueue: state.messageQueue,
    subagentStates: state.subagentStates,
    ...(state.metadata ? { metadata: state.metadata } : {})
  };

  sessionStore.setValue(CHECKPOINT_KEY, cp);

  return cp;
}

/**
 * Load the most recent runtime checkpoint from the session store.
 *
 * @param sessionStore - The session store to read from.
 * @returns The checkpoint, or `null` if none exists.
 */
export function loadCheckpoint(sessionStore: Pick<SessionStore, 'getValue'>): RuntimeCheckpoint | null {
  const raw = sessionStore.getValue(CHECKPOINT_KEY);
  if (!raw) {
    return null;
  }

  const cp = raw as RuntimeCheckpoint;
  if (typeof cp.id !== 'string' || typeof cp.timestamp !== 'number' || !Array.isArray(cp.pendingToolCalls)) {
    return null;
  }

  return cp;
}

/**
 * Delete the current runtime checkpoint from the session store.
 */
export function clearCheckpoint(sessionStore: Pick<SessionStore, 'removeValue'>): void {
  sessionStore.removeValue(CHECKPOINT_KEY);
}
