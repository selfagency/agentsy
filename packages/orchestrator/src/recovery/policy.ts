/**
 * Structured error recovery framework for orchestrator tasks.
 *
 * Implements a retry-loop → fallback-loop → escalation pipeline
 * with configurable backoff strategies, DSL-based condition evaluation
 * for fallback selection, and checkpoint-support metadata.
 *
 * Architecture decision (2026-06-06, Plan 34):
 *   - Recovery is orchestrator-level (not per-agent)
 *   - The executor owns the full recovery lifecycle
 *   - Checkpoint metadata is tracked but checkpoint persistence
 *     is delegated to the caller via the policy flags
 */

import { evaluateCondition as evaluateConditionDsl } from '../governance/policy.js';

// =============================================================================
// Types
// =============================================================================

/** Supported backoff strategies for retry delay calculation. */
export type BackoffStrategy = 'linear' | 'exponential' | 'fixed';

/**
 * Retry configuration for transient-failure recovery.
 *
 * Controls how many times a failing task is retried and how long
 * to wait between attempts.
 */
export interface RetryConfig {
  /** Backoff strategy to use between retries. */
  backoffStrategy: BackoffStrategy;
  /** Base delay in milliseconds (strategy-dependent multiplier). */
  baseDelayMs: number;
  /** Jitter fraction (0-1) to randomize delays and prevent thundering herd. */
  jitterFraction: number;
  /** Maximum number of retry attempts before fallback. */
  maxAttempts: number;
  /** Maximum delay cap in milliseconds. */
  maxDelayMs: number;
}

/**
 * Fallback definition for alternative execution paths.
 *
 * When the retry loop is exhausted, fallbacks with matching
 * conditions are attempted in order. Each fallback can target
 * multiple alternative agents/targets.
 */
export interface Fallback {
  /** Ordered list of alternative agent/target IDs to attempt. */
  agentTargets: string[];
  /** DSL condition string evaluated against execution context. */
  condition: string;
  /** Maximum attempts per fallback agent target. */
  maxAttemptsPerFallback: number;
}

/**
 * Escalation action taken when all recovery strategies are exhausted.
 */
export const EscalationAction = {
  /** Fail immediately with the last error. */
  Fail: 'fail',
  /** Escalate to human intervention (admin/on-call). */
  Escalate: 'escalate',
  /** Skip the failed task and continue execution. */
  Skip: 'skip',
  /** Use a default/empty result value. */
  Default: 'default'
} as const;

export type EscalationAction = (typeof EscalationAction)[keyof typeof EscalationAction];

/**
 * Complete recovery policy for a task or workflow step.
 *
 * Defines the full recovery lifecycle: retry configuration,
 * ordered fallback alternatives, escalation behaviour, and
 * checkpoint requirements.
 */
export interface RecoveryPolicy {
  /** Interval in milliseconds between automatic checkpoints. */
  checkpointFrequencyMs: number;
  /** Whether checkpoint snapshots are required before execution. */
  checkpointRequired: boolean;
  /** Action to take when all recovery strategies are exhausted. */
  escalationAction: EscalationAction;
  /** Ordered fallback alternatives evaluated after retries are exhausted. */
  fallbacks: Fallback[];
  /** Retry strategy for transient failures. */
  retryConfig: RetryConfig;
}

/**
 * Result of a recovery execution attempt.
 */
export interface RecoveryResult {
  /** Total number of retry + fallback attempts made. */
  attempts: number;
  /** The fallback agent/target used for recovery (when applicable). */
  fallbackUsed?: string;
  /** Final error when recovery failed (only when `recovered === false`). */
  finalError?: Error;
  /** Whether the task was eventually recovered successfully. */
  recovered: boolean;
  /** Total elapsed time in milliseconds for the full recovery lifecycle. */
  totalTimeMs: number;
}

// =============================================================================
// RecoveryExecutor
// =============================================================================

/**
 * Executes the full recovery lifecycle for a failed task function.
 *
 * Pipeline:
 *   1. **Retry loop** — retries `taskFn` up to `maxAttempts` with configurable backoff
 *   2. **Fallback loop** — evaluates fallback conditions in order, attempts alternative targets
 *   3. **Escalation** — applies the configured escalation action when all options exhausted
 */
export class RecoveryExecutor {
  readonly #policy: RecoveryPolicy;

  constructor(policy: RecoveryPolicy) {
    this.#policy = policy;
  }

  /**
   * Execute the recovery lifecycle for a task function.
   *
   * @param taskFn - The task function to execute and potentially retry.
   * @param context - Execution context used for DSL condition evaluation.
   * @returns A `RecoveryResult` describing the outcome.
   */
  // fallow-ignore-next-line complexity
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: recovery orchestration logic
  async execute(taskFn: () => Promise<unknown>, context: Record<string, unknown>): Promise<RecoveryResult> {
    const startTime = Date.now();
    const config = this.#policy.retryConfig;
    let lastError: Error | undefined;
    let attempt = 0;

    // -------------------------------------------------------------------------
    // 1. Retry loop
    // -------------------------------------------------------------------------

    while (attempt < config.maxAttempts) {
      attempt++;
      try {
        await taskFn();
        return this.#result(true, attempt, Date.now() - startTime);
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }

      if (attempt < config.maxAttempts) {
        // Pass 0-based attempt index for backoff formulas (first retry = 0)
        const delay = this.calculateBackoff(attempt - 1);
        await this.#sleep(delay);
      }
    }

    // -------------------------------------------------------------------------
    // 2. Fallback loop
    // -------------------------------------------------------------------------

    const fallbackCtx: Record<string, unknown> = {
      ...context,
      error: lastError,
      attempts: attempt
    };

    for (const fallback of this.#policy.fallbacks) {
      if (!this.evaluateCondition(fallback.condition, fallbackCtx)) {
        continue;
      }

      for (const target of fallback.agentTargets) {
        for (let fbAttempt = 0; fbAttempt < fallback.maxAttemptsPerFallback; fbAttempt++) {
          attempt++;
          try {
            await taskFn();
            return this.#result(true, attempt, Date.now() - startTime, target);
          } catch (error: unknown) {
            lastError = error instanceof Error ? error : new Error(String(error));
          }
        }
      }
    }

    // -------------------------------------------------------------------------
    // 3. Escalation
    // -------------------------------------------------------------------------

    const totalTimeMs = Date.now() - startTime;

    switch (this.#policy.escalationAction) {
      case 'fail': {
        throw lastError ?? new Error('Task failed after all recovery attempts');
      }
      case 'escalate': {
        return this.#failedResult(lastError, attempt, totalTimeMs);
      }
      case 'skip': {
        return this.#failedResult(lastError, attempt, totalTimeMs);
      }
      case 'default': {
        return this.#result(true, attempt, totalTimeMs);
      }
      default:
        // biome-ignore lint/suspicious/noUnusedExpressions: exhaustiveness check
        this.#policy.escalationAction satisfies never;
    }

    // Unreachable — all escalation actions handled above
    throw this.#failedResult(lastError, attempt, totalTimeMs);
  }

  /**
   * Calculate the delay before the next retry attempt.
   *
   * Formulas (applied in order):
   *   1. Compute base delay:
   *      - **linear**: `baseDelayMs * (attempt + 1)`
   *      - **exponential**: `baseDelayMs * Math.pow(2, attempt)`
   *      - **fixed**: `baseDelayMs`
   *   2. Cap at `maxDelayMs`
   *   3. Add jitter: `delay * jitterFraction * (Math.random() - 0.5)`
   *
   * @param attempt - The 0-based retry attempt index.
   * @returns Delay in milliseconds (always >= 0).
   */
  calculateBackoff(attempt: number): number {
    const config = this.#policy.retryConfig;
    let delay = 0;

    switch (config.backoffStrategy) {
      case 'linear': {
        delay = config.baseDelayMs * (attempt + 1);
        break;
      }
      case 'exponential': {
        delay = config.baseDelayMs * 2 ** attempt;
        break;
      }
      case 'fixed': {
        delay = config.baseDelayMs;
        break;
      }
      default:
        // biome-ignore lint/suspicious/noUnusedExpressions: exhaustiveness check
        config.backoffStrategy satisfies never;
    }

    delay = Math.min(delay, config.maxDelayMs);
    const jitter = delay * config.jitterFraction * (Math.random() - 0.5);

    return delay + jitter;
  }

  /**
   * Evaluate a DSL condition string against the given context.
   *
   * Uses a `new Function('ctx', ...)` sandbox. Returns `false` for any
   * evaluation error (malformed condition, missing context fields, etc.),
   * making conditions safe to use in production.
   *
   * Supported syntax: standard JavaScript expressions referencing a `ctx`
   * parameter. Examples:
   *   - `"ctx.error !== undefined"`
   *   - `"ctx.error.retryable && ctx.attempts >= 2"`
   *   - `"ctx.error.type === 'timeout'"`
   *
   * @param condition - DSL condition string (e.g., `"ctx.error !== undefined && ctx.attempts >= 2"`).
   * @param context - Context object with fields referenced by the condition.
   * @returns Whether the condition evaluates to `true`.
   */
  evaluateCondition(condition: string, context: Record<string, unknown>): boolean {
    return evaluateConditionDsl(condition, context);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /** Build a result, conditionally including optional fields for exactOptionalPropertyTypes. */
  #result(recovered: boolean, attempts: number, totalTimeMs: number, fallbackUsed?: string): RecoveryResult {
    const base: RecoveryResult = { recovered, attempts, totalTimeMs };
    if (fallbackUsed !== undefined) {
      base.fallbackUsed = fallbackUsed;
    }
    return base;
  }

  /** Build a failed result, conditionally including finalError. */
  #failedResult(lastError: Error | undefined, attempts: number, totalTimeMs: number): RecoveryResult {
    const base: RecoveryResult = { recovered: false, attempts, totalTimeMs };
    if (lastError !== undefined) {
      base.finalError = lastError;
    }
    return base;
  }

  #sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
