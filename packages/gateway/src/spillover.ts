/**
 * Spillover chain for model-call failover.
 *
 * When a model call fails, the spillover logic tries:
 *   1. Next replica for the same logical model
 *   2. Next logical model in the same tier
 *   3. Tier escalation (if caller allows)
 *
 * Each step is configurable. The orchestrator controls whether
 * escalation is permitted; the gateway executes the chain.
 */

import { getLogicalModelsByTier } from './logical-models.js';
import type { ReplicaRegistry } from './replica-registry.js';
import type { ReplicaSelectionContext, ReplicaSelector } from './replica-selector.js';
import type { ModelReplica, ModelTier } from './types.js';

/**
 * Spillover attempt result. `undefined` means no candidate found.
 */
export interface SpilloverResult {
  /** Human-readable explanation of why this candidate was chosen. */
  reason: string;
  /** The selected replica for the next attempt. */
  replica: ModelReplica;
}

/**
 * Try the next replica for the same logical model. Returns the
 * best remaining candidate, excluding the given `excludeReplicaIds`.
 */
export function spilloverSameReplica(
  logicalModelId: string,
  registry: ReplicaRegistry,
  selector: ReplicaSelector,
  context: ReplicaSelectionContext,
  excludeReplicaIds: Set<string>
): SpilloverResult | undefined {
  const replicas = registry.getByLogicalModel(logicalModelId).filter(r => !excludeReplicaIds.has(r.id));
  const candidate = selector.selectReplica(replicas, context);
  if (candidate === undefined) {
    return;
  }
  return { replica: candidate, reason: `next replica for ${logicalModelId}` };
}

/**
 * Try the next logical model in the same tier. Excludes the
 * given `logicalModelIds`.
 */
export function spilloverSameTier(
  tier: ModelTier,
  registry: ReplicaRegistry,
  selector: ReplicaSelector,
  context: ReplicaSelectionContext,
  excludedLogicalModelIds: Set<string>
): SpilloverResult | undefined {
  const models = getLogicalModelsByTier(tier).filter(m => !excludedLogicalModelIds.has(m.id));
  for (const model of models) {
    const replicas = registry.getByLogicalModel(model.id);
    const candidate = selector.selectReplica(replicas, context);
    if (candidate !== undefined) {
      return { replica: candidate, reason: `next model in tier ${tier}: ${model.id}` };
    }
  }
}

/**
 * Escalate to the next tier. Returns `undefined` if escalation
 * is not allowed by the caller.
 */
export function spilloverEscalate(
  currentTier: ModelTier,
  escalationChain: readonly ModelTier[],
  registry: ReplicaRegistry,
  selector: ReplicaSelector,
  context: ReplicaSelectionContext
): SpilloverResult | undefined {
  const currentIdx = escalationChain.indexOf(currentTier);
  if (currentIdx < 0 || currentIdx >= escalationChain.length - 1) {
    return;
  }
  const nextTier = escalationChain[currentIdx + 1];
  if (nextTier === undefined) {
    return;
  }
  const models = getLogicalModelsByTier(nextTier);
  for (const model of models) {
    const replicas = registry.getByLogicalModel(model.id);
    const candidate = selector.selectReplica(replicas, context);
    if (candidate !== undefined) {
      return { replica: candidate, reason: `escalated to tier ${nextTier}: ${model.id}` };
    }
  }
}

/**
 * Full spillover chain. Tries same-replica, same-tier, then
 * escalation in order. Returns the first success.
 */
export function spillover(
  logicalModelId: string,
  tier: ModelTier,
  registry: ReplicaRegistry,
  selector: ReplicaSelector,
  context: ReplicaSelectionContext,
  options?: {
    escalationChain?: readonly ModelTier[];
    excludeReplicas?: Set<string>;
    excludeModels?: Set<string>;
    allowEscalation?: boolean;
  }
): SpilloverResult | undefined {
  const excludeReplicas = options?.excludeReplicas ?? new Set<string>();
  const excludeModels = new Set(options?.excludeModels ?? [logicalModelId]);

  // 1. Same logical model, different replica
  const result = spilloverSameReplica(logicalModelId, registry, selector, context, excludeReplicas);
  if (result !== undefined) {
    return result;
  }

  // 2. Same tier, different logical model
  if (options?.allowEscalation !== false) {
    const tierResult = spilloverSameTier(tier, registry, selector, context, excludeModels);
    if (tierResult !== undefined) {
      return tierResult;
    }
  }

  // 3. Escalate tier
  if (options?.allowEscalation !== false) {
    const chain = options?.escalationChain;
    const escalateResult = spilloverEscalate(
      tier,
      chain ?? ['micro', 'small', 'mid', 'frontier'],
      registry,
      selector,
      context
    );
    if (escalateResult !== undefined) {
      return escalateResult;
    }
  }
}
