/**
 * Retry-aware execution context for failover chains.
 *
 * Tracks retry state across replica attempts and escalation levels
 * so that the runtime can make informed decisions about when to
 * retry a failed model call, switch replicas, or escalate.
 */

/** Tracks retry state within a failover chain across replicas. */
export interface RetryContext {
  /** Replicas that have already been attempted (in order). */
  attemptedReplicas: string[];
  /** How many times the failure has escalated (0 = initial). */
  escalationLevel: number;
  /** Maximum number of retry attempts allowed. */
  maxRetries: number;
  /** Base delay in ms between retry attempts. */
  retryDelayMs: number;
}

/** Options for creating a new RetryContext. */
export interface RetryContextOptions {
  maxRetries?: number;
  retryDelayMs?: number;
  attemptedReplicas?: string[];
  escalationLevel?: number;
}

/**
 * Create a new RetryContext with sensible defaults.
 *
 * @param options - Optional overrides for retry configuration
 * @returns A new RetryContext instance
 */
export function createRetryContext(options?: RetryContextOptions): RetryContext {
  return {
    maxRetries: options?.maxRetries ?? 3,
    retryDelayMs: options?.retryDelayMs ?? 1000,
    attemptedReplicas: options?.attemptedReplicas ?? [],
    escalationLevel: options?.escalationLevel ?? 0
  };
}

/**
 * Determine whether another retry attempt should be made.
 *
 * Returns `false` when the maximum number of retries has been reached
 * OR when all available replicas have already been attempted.
 *
 * @param context - The current retry context
 * @param replicaCount - Total number of available replicas
 * @returns `true` if another retry should be attempted
 */
export function shouldRetry(context: RetryContext, replicaCount: number): boolean {
  if (context.attemptedReplicas.length >= context.maxRetries) {
    return false;
  }
  if (context.attemptedReplicas.length >= replicaCount) {
    return false;
  }
  return true;
}

/**
 * Record an attempt on a specific replica.
 *
 * Adds the replicaId to the attemptedReplicas list and returns a new
 * RetryContext. The original context is not mutated.
 *
 * @param context - The current retry context
 * @param replicaId - Identifier of the replica being attempted
 * @returns A new RetryContext with the attempt recorded
 */
export function markAttempt(context: RetryContext, replicaId: string): RetryContext {
  return {
    ...context,
    attemptedReplicas: [...context.attemptedReplicas, replicaId]
  };
}

/**
 * Check whether the current failure should be escalated.
 *
 * Escalation is triggered when retries are exhausted (all allowed
 * attempts have been made).
 *
 * @param context - The current retry context
 * @returns `true` if escalation is needed
 */
export function shouldEscalate(context: RetryContext): boolean {
  return context.attemptedReplicas.length >= context.maxRetries;
}

/**
 * Increment the escalation level.
 *
 * Returns a new RetryContext with the escalation level increased by 1.
 * The original context is not mutated.
 *
 * @param context - The current retry context
 * @returns A new RetryContext with escalated level
 */
export function incrementEscalation(context: RetryContext): RetryContext {
  return {
    ...context,
    escalationLevel: context.escalationLevel + 1
  };
}
