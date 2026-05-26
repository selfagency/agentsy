import type { SessionStore } from '@agentsy/session';
import type { RuntimeSnapshot } from '@agentsy/types';

/**
 * A serializable interruption checkpoint stored in the session.
 */
export interface InterruptionCheckpoint {
  id: string;
  metadata?: Record<string, unknown>;
  reason: string;
  sessionId: string;
  snapshot: RuntimeSnapshot;
  timestamp: number;
}

let _checkpointCounter = 0;
function nextCheckpointId(): string {
  _checkpointCounter++;
  return `chk_${Date.now()}_${_checkpointCounter}`;
}

const CHECKPOINT_KEY_PREFIX = 'interruption_checkpoint:';

/**
 * Create an interruption checkpoint.
 *
 * Serializes the current runtime snapshot and halts execution by storing
 * the checkpoint in the session store. The session's state is preserved
 * so it can be resumed later via {@link resumeFromCheckpoint}.
 *
 * @param sessionId - The session being interrupted.
 * @param reason - Human-readable reason for the interruption.
 * @param snapshot - The current `RuntimeSnapshot` to preserve.
 * @param sessionStore - The session store for persisting checkpoints.
 * @param metadata - Optional extra context (e.g. pending tool call IDs).
 * @returns The created `InterruptionCheckpoint`.
 */
export async function createInterruption(
  sessionId: string,
  reason: string,
  snapshot: RuntimeSnapshot,
  sessionStore: Pick<SessionStore, 'setValue'>,
  metadata?: Record<string, unknown>
): Promise<InterruptionCheckpoint> {
  const id = nextCheckpointId();
  const timestamp = Date.now();

  const checkpoint: InterruptionCheckpoint = {
    id,
    sessionId,
    reason,
    timestamp,
    snapshot,
    ...(metadata ? { metadata } : {})
  };

  sessionStore.setValue(`${CHECKPOINT_KEY_PREFIX}${id}`, checkpoint);

  return checkpoint;
}

/**
 * Resume execution from a stored interruption checkpoint.
 *
 * Loads the checkpoint from the session store and returns it so the
 * runtime loop can restore state and continue.
 *
 * @param checkpointId - The checkpoint id (returned by `createInterruption`).
 * @param sessionStore - The session store to read from.
 * @returns The restored `InterruptionCheckpoint`, or `null` if not found.
 */
export async function resumeFromCheckpoint(
  checkpointId: string,
  sessionStore: Pick<SessionStore, 'getValue'>
): Promise<InterruptionCheckpoint | null> {
  const raw = sessionStore.getValue(`${CHECKPOINT_KEY_PREFIX}${checkpointId}`);
  if (!raw) {
    return null;
  }

  const checkpoint = raw as InterruptionCheckpoint;

  // Basic structural validation
  if (
    typeof checkpoint.id !== 'string' ||
    typeof checkpoint.sessionId !== 'string' ||
    typeof checkpoint.timestamp !== 'number' ||
    !checkpoint.snapshot
  ) {
    return null;
  }

  return checkpoint;
}
