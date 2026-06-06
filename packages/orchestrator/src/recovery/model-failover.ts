/**
 * Multi-replica failover chain for model-call retry.
 *
 * Builds an ordered sequence of failover steps from the original
 * model and available replicas. The chain advances step-by-step:
 *   1. Same replica retry (transient-error recovery)
 *   2. Next replica for the same logical model
 *   3. Next logical model in the same tier
 *   4. Tier escalation (if the escalation policy allows it)
 *
 * The orchestrator controls whether escalation is permitted;
 * the chain is constructed respecting the escalation policy.
 *
 * Architecture decision (2026-06-06, Plan 34):
 *   - Failover is orchestrator-level (not gateway-level)
 *   - Each step points to a specific replica or model
 *   - ExhaustedError is thrown when no steps remain
 *   - The caller invokes `getNextStep` on model-call failure
 */

import { getLogicalModel } from '@agentsy/gateway';
import type { ModelEntry, ModelReplica, ModelTier } from '@agentsy/gateway';

import type { EscalationPolicy } from '../intelligence/model-router.js';
import type { CircuitBreakerSet } from './circuit-breaker-set.js';

// =============================================================================
// Types
// =============================================================================

export type FailoverStepType = 'same-replica-retry' | 'next-replica' | 'next-model' | 'tier-escalation';

/**
 * One step in the failover chain.
 *
 * - `same-replica-retry`: retry the same replica (no `replicaId` — caller
 *   keeps the original). Useful for transient network blips.
 * - `next-replica`: a different replica for the same logical model.
 * - `next-model`: a different logical model in the same tier.
 * - `tier-escalation`: a replica from a higher tier.
 */
export interface FailoverStep {
  type: FailoverStepType;
  /** Logical model to use for this step. */
  logicalModelId?: string;
  /** Specific replica to target. Omitted for `same-replica-retry`. */
  replicaId?: string;
  /** Model tier for this step. */
  tier?: ModelTier;
}

/**
 * Ordered failover chain with positional cursor.
 * The caller advances `currentStep` on each failure via `getNextStep`.
 */
export interface FailoverChain {
  /** Index of the *next* step to try. Starts at 0. */
  currentStep: number;
  /** Ordered list of failover steps. */
  steps: FailoverStep[];
}

// =============================================================================
// ExhaustedError
// =============================================================================

/**
 * Thrown when `getNextStep` is called but the chain has no remaining steps.
 * Captures the full chain and the total number of attempts for diagnostics.
 */
export class ExhaustedError extends Error {
  readonly chain: readonly FailoverStep[];
  readonly attempts: number;

  constructor(chain: FailoverStep[], attempts: number) {
    super(`Failover chain exhausted after ${attempts} attempt(s)`);
    this.name = 'ExhaustedError';
    this.chain = chain;
    this.attempts = attempts;
  }
}

// =============================================================================
// Chain construction
// =============================================================================

const DEFAULT_CHAIN: readonly ModelTier[] = ['micro', 'small', 'mid', 'frontier'] as const;

/**
 * Build a `FailoverChain` from the originally-selected model, all available
 * replicas, and the escalation policy.
 *
 * The chain is ordered: same-replica-retry → next-replicas (same model) →
 * next-models (same tier) → tier-escalation (if allowed).
 *
 * Each distinct replica gets its own step so the caller can track individual
 * failures and circuit-break per-replica.
 */
export function createFailoverChain(
  originalModel: ModelEntry,
  replicas: ModelReplica[],
  escalationPolicy: EscalationPolicy,
  circuitBreakerSet?: CircuitBreakerSet
): FailoverChain {
  const steps: FailoverStep[] = [];
  const seenReplicaIds = new Set<string>();
  const seenModelIds = new Set<string>([originalModel.id]);

  // 1. Same-replica retry — no replicaId, caller keeps the original
  steps.push({
    type: 'same-replica-retry',
    logicalModelId: originalModel.id,
    tier: originalModel.tier
  });

  // 2. Next replicas for the same logical model
  for (const replica of replicas) {
    if (
      replica.logicalModelId === originalModel.id &&
      !seenReplicaIds.has(replica.id) &&
      !circuitBreakerSet?.isOpen(replica.id)
    ) {
      seenReplicaIds.add(replica.id);
      steps.push({
        type: 'next-replica',
        logicalModelId: originalModel.id,
        replicaId: replica.id,
        tier: originalModel.tier
      });
    }
  }

  // 3. Next logical models in the same tier
  for (const replica of replicas) {
    if (
      getLogicalModel(replica.logicalModelId)?.tier === originalModel.tier &&
      replica.logicalModelId !== originalModel.id &&
      !seenReplicaIds.has(replica.id)
    ) {
      if (!seenModelIds.has(replica.logicalModelId)) {
        seenModelIds.add(replica.logicalModelId);
      }
      seenReplicaIds.add(replica.id);
      steps.push({
        type: 'next-model',
        logicalModelId: replica.logicalModelId,
        replicaId: replica.id,
        tier: originalModel.tier
      });
    }
  }

  // 4. Tier escalation (only when allowed)
  if (escalationPolicy.allowEscalation) {
    const chain = escalationPolicy.chain ?? DEFAULT_CHAIN;
    const currentTierIndex = chain.indexOf(originalModel.tier);
    const maxSteps = escalationPolicy.maxSteps ?? chain.length;

    if (currentTierIndex >= 0) {
      const escalationTiers = chain.slice(currentTierIndex + 1, currentTierIndex + 1 + maxSteps);

      for (const nextTier of escalationTiers) {
        for (const replica of replicas) {
          if (getLogicalModel(replica.logicalModelId)?.tier === nextTier && !seenReplicaIds.has(replica.id)) {
            seenReplicaIds.add(replica.id);
            steps.push({
              type: 'tier-escalation',
              logicalModelId: replica.logicalModelId,
              replicaId: replica.id,
              tier: nextTier
            });
          }
        }
      }
    }
  }

  return { currentStep: 0, steps };
}

/**
 * Advance the chain to the next step. Throws `ExhaustedError` when the
 * chain is fully consumed.
 *
 * @param chain - The failover chain to advance (mutates `currentStep`).
 * @param _lastError - The error that caused the previous step to fail
 *   (reserved for future use — e.g. routing decisions based on error type).
 * @returns The next `FailoverStep`, or `undefined` if the chain is empty
 *   (defensive — the empty case throws `ExhaustedError`).
 */
export function getNextStep(chain: FailoverChain, _lastError: Error): FailoverStep | undefined {
  chain.currentStep++;

  if (chain.currentStep >= chain.steps.length) {
    throw new ExhaustedError([...chain.steps], chain.currentStep);
  }

  return chain.steps[chain.currentStep];
}
