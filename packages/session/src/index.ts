/**
 * @agentsy/session — Session persistence, serialization, and branching
 *
 * ## Packages
 *
 * - {@link ./state/index.ts | state } — Zod-validated typed state schema + immutable reducers
 * - {@link ./store.ts | store }     — Key-value session store backed by in-memory maps
 *
 * @module
 */

export {
  createSessionSnapshot,
  createSessionStore,
  type CreateSessionSnapshotInput,
  type ReusableSessionSegment,
  type SessionSnapshot,
  type SessionState as LegacySessionState,
  type SessionStore
} from './store.js';

// Typed state layer (Phase 6)
export * from './state/index.js';
