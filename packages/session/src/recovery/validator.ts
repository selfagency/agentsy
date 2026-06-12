/**
 * Session state integrity validator.
 *
 * Checks:
 *  - Zod schema compliance
 *  - Message role alternation (user ↔ assistant)
 *  - Timeline monotonicity
 *  - Checkpoint consistency
 *
 * @module
 */

import type { Checkpoint, SessionState } from '../state/schema.js';
import { MessageSchema, SessionStateSchema } from '../state/schema.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IntegrityResult {
  /** Human-readable error messages. */
  errors: string[];
  /** Overall validity verdict. */
  valid: boolean;
  /** Non-blocking warnings. */
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

/**
 * Run all integrity checks on a session state.
 */
export function validateIntegrity(state: Record<string, unknown>): IntegrityResult {
  const result: IntegrityResult = { valid: true, errors: [], warnings: [] };

  // ---- 1. Schema compliance ----
  const parsed = SessionStateSchema.safeParse(state);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      result.errors.push(`Schema violation: ${issue.path.join('.')} — ${issue.message}`);
    }
    result.valid = false;
    // Cannot proceed with schema-invalid state
    return result;
  }

  const validState = parsed.data;

  // ---- 2. Timeline monotonicity ----
  if (validState.updatedAt < validState.createdAt) {
    result.errors.push(`Timeline violation: updatedAt (${validState.updatedAt}) < createdAt (${validState.createdAt})`);
    result.valid = false;
  }

  // ---- 3. Message integrity ----
  const { messages } = validState;
  if (messages.length > 0) {
    validateMessages(messages, result, validState);
  }

  // ---- 4. Checkpoint consistency ----
  validateCheckpoints(validState, result);

  return result;
}

// ---------------------------------------------------------------------------
// Internal validators
// ---------------------------------------------------------------------------

/**
 * Determine the expected next role given the current message.
 */
function nextExpectedRole(
  msg: { role?: string },
  nextRole: string | undefined
): 'user' | 'assistant' | 'tool' | undefined {
  if (msg.role === 'user') {
    return 'assistant';
  }
  if (msg.role === 'assistant') {
    return nextRole === 'tool' ? 'tool' : 'user';
  }
  if (msg.role === 'tool') {
    return 'tool';
  }
}

function validateMessages(messages: Record<string, unknown>[], result: IntegrityResult, _state: SessionState): void {
  if (messages.length === 0) {
    return;
  }

  validateMessageSchemas(messages, result);
  validateRoleAlternation(messages, result);
}

function validateMessageSchemas(messages: Record<string, unknown>[], result: IntegrityResult): void {
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (!msg) {
      continue;
    }
    const parsed = MessageSchema.safeParse(msg);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        result.errors.push(`Message[${i}] schema violation: ${issue.path.join('.')} — ${issue.message}`);
      }
      result.valid = false;
    }
  }
}

function validateRoleAlternation(messages: Record<string, unknown>[], result: IntegrityResult): void {
  let expectedRole: 'user' | 'assistant' | 'tool' | undefined;
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i] as { role?: string } | undefined;
    if (!msg?.role) {
      continue;
    }

    if (msg.role === 'system') {
      continue;
    }

    if (expectedRole && msg.role !== expectedRole) {
      result.warnings.push(`Message[${i}]: expected role "${expectedRole}" but got "${msg.role}"`);
    }

    const nextMsg = messages[i + 1] as { role?: string } | undefined;
    expectedRole = nextExpectedRole(msg, nextMsg?.role);
  }
}

function validateCheckpoints(state: SessionState, result: IntegrityResult): void {
  const { checkpoints, messages } = state;

  if (checkpoints.length === 0) {
    return;
  }

  for (let i = 0; i < checkpoints.length; i++) {
    const cp = checkpoints[i];
    if (!cp) {
      continue;
    }
    validateCheckpointBounds(cp, i, messages.length, state, result);
  }

  const timestamps = checkpoints.map(c => c.createdAt);
  const duplicates = timestamps.filter((t, idx) => timestamps.indexOf(t) !== idx);
  if (duplicates.length > 0) {
    result.warnings.push(`Duplicate checkpoint timestamps detected: ${[...new Set(duplicates)].join(', ')}`);
  }
}

function validateCheckpointBounds(
  cp: Checkpoint,
  index: number,
  messageCount: number,
  state: SessionState,
  result: IntegrityResult
): void {
  if (cp.messageCount !== undefined && (cp.messageCount < 0 || cp.messageCount > messageCount)) {
    result.warnings.push(`Checkpoint[${index}]: messageCount ${cp.messageCount} out of bounds (0-${messageCount})`);
  }

  if (cp.createdAt > state.updatedAt) {
    result.warnings.push(
      `Checkpoint[${index}]: createdAt (${cp.createdAt}) exceeds state updatedAt (${state.updatedAt})`
    );
  }

  if (cp.createdAt < state.createdAt) {
    result.warnings.push(
      `Checkpoint[${index}]: createdAt (${cp.createdAt}) precedes state createdAt (${state.createdAt})`
    );
  }
}
