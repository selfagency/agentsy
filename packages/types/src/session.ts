/**
 * Session state management types.
 */

import type { SessionId } from './brands.js';

export type { SessionId };

export interface SessionState {
  /** Session identifier. */
  id: SessionId;

  /** Key-value state store. */
  values: Record<string, unknown>;

  /** Optional metadata. */
  metadata?: Record<string, unknown>;
}

/**
 * Session store interface for persistence.
 */
export interface SessionStore {
  /** Get full session state. */
  getState(): SessionState;

  /** Get a specific value. */
  getValue<T>(key: string): T | undefined;

  /** Set a value. */
  setValue(key: string, value: unknown): void;

  /** Remove a value. */
  removeValue(key: string): void;

  /** Clear entire session. */
  clear(): void;
}