/**
 * Context fingerprint — cache-aware context reuse via fingerprint comparison.
 *
 * Computes a fingerprint of the current context state that can be compared
 * against a prior snapshot's checksum to determine if the cached context
 * is still valid for reuse. Reduces re-encoding tokens on session resume.
 */

import { createHash } from 'node:crypto';

/**
 * Snapshot of the current execution context used for cache-validity comparison.
 */
export interface ContextFingerprint {
  /** SHA-256 hash of the serialized context content. */
  hash: string;
  /** When memory was last refreshed (ISO string or epoch ms). */
  lastMemoryRefresh: string;
  /** Number of messages in the current context. */
  messageCount: number;
  /** Model identifier. */
  modelId: string;
}

export interface ComputeFingerprintOptions {
  /** Serialized context content to hash. */
  contextContent: string;
  /** ISO timestamp of last memory refresh. */
  lastMemoryRefresh: string;
  /** Number of messages in context. */
  messageCount: number;
  /** Model identifier. */
  modelId: string;
}

/**
 * Compute a context fingerprint from the current execution state.
 */
export function computeContextFingerprint(options: ComputeFingerprintOptions): ContextFingerprint {
  return {
    hash: createHash('sha256').update(options.contextContent).digest('hex'),
    lastMemoryRefresh: options.lastMemoryRefresh,
    messageCount: options.messageCount,
    modelId: options.modelId
  };
}

/**
 * Determine whether a previously cached context can be reused.
 *
 * Returns `true` when the new fingerprint matches all dimensions of the
 * cached snapshot: same model, same message count, same memory refresh
 * time, and same content hash. When `false`, the caller should rebuild
 * the context rather than reusing the cached version.
 */
export function isCacheValid(fresh: ContextFingerprint, cached: ContextFingerprint): boolean {
  return (
    fresh.modelId === cached.modelId &&
    fresh.messageCount === cached.messageCount &&
    fresh.lastMemoryRefresh === cached.lastMemoryRefresh &&
    fresh.hash === cached.hash
  );
}
