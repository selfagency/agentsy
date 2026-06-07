/**
 * ReplicaRegistry — stores `ModelReplica` entries indexed by
 * `logicalModelId` and `providerId`.
 *
 * A replica is one way to reach a logical model through a specific
 * provider/account. Multiple replicas may serve the same logical
 * model (e.g. anthropic-main + anthropic-secondary both serving
 * claude-sonnet-4).
 *
 * Supports phase-aware registration: replicas can be marked as
 * 'active' (normal), 'draining' (skip for selection, use for
 * spillover), or 'standby' (reserve capacity).
 */

import type { ModelReplica } from './types.js';

export type ReplicaPhase = 'active' | 'draining' | 'standby';

export class ReplicaRegistry {
  readonly #replicas = new Map<string, ModelReplica>();
  readonly #byLogicalModel = new Map<string, ModelReplica[]>();
  readonly #byProvider = new Map<string, ModelReplica[]>();
  readonly #phases = new Map<string, ReplicaPhase>();

  register(replica: ModelReplica, phase: ReplicaPhase = 'active'): void {
    this.#replicas.set(replica.id, replica);
    this.#phases.set(replica.id, phase);

    let forModel = this.#byLogicalModel.get(replica.logicalModelId);
    if (forModel === undefined) {
      forModel = [];
      this.#byLogicalModel.set(replica.logicalModelId, forModel);
    }
    forModel.push(replica);

    let forProvider = this.#byProvider.get(replica.providerId);
    if (forProvider === undefined) {
      forProvider = [];
      this.#byProvider.set(replica.providerId, forProvider);
    }
    forProvider.push(replica);
  }

  getById(id: string): ModelReplica | undefined {
    return this.#replicas.get(id);
  }

  getByLogicalModel(logicalModelId: string): ModelReplica[] {
    return this.#byLogicalModel.get(logicalModelId) ?? [];
  }

  getByProvider(providerId: string): ModelReplica[] {
    return this.#byProvider.get(providerId) ?? [];
  }

  getAll(): ModelReplica[] {
    return [...this.#replicas.values()];
  }

  /** Get all replicas in a given phase. */
  getByPhase(phase: ReplicaPhase): ModelReplica[] {
    const result: ModelReplica[] = [];
    for (const [id, p] of this.#phases) {
      if (p === phase) {
        const replica = this.#replicas.get(id);
        if (replica !== undefined) {
          result.push(replica);
        }
      }
    }
    return result;
  }

  /** Get the phase for a replica (defaults to 'active'). */
  getPhase(id: string): ReplicaPhase {
    return this.#phases.get(id) ?? 'active';
  }

  /** Set the phase for an existing replica. */
  setPhase(id: string, phase: ReplicaPhase): void {
    if (this.#replicas.has(id)) {
      this.#phases.set(id, phase);
    }
  }

  /**
   * Get all healthy (non-draining) replicas for a logical model.
   * Draining replicas are skipped during normal selection but
   * remain available for spillover/fallback.
   */
  getHealthyReplicasForModel(logicalModelId: string): ModelReplica[] {
    return this.#byLogicalModel.get(logicalModelId)?.filter(r => this.#phases.get(r.id) !== 'draining') ?? [];
  }

  remove(id: string): void {
    const replica = this.#replicas.get(id);
    if (replica === undefined) {
      return;
    }

    this.#replicas.delete(id);
    this.#phases.delete(id);

    const forModel = this.#byLogicalModel.get(replica.logicalModelId);
    if (forModel !== undefined) {
      const idx = forModel.findIndex(r => r.id === id);
      if (idx >= 0) {
        forModel.splice(idx, 1);
      }
    }

    const forProvider = this.#byProvider.get(replica.providerId);
    if (forProvider !== undefined) {
      const idx = forProvider.findIndex(r => r.id === id);
      if (idx >= 0) {
        forProvider.splice(idx, 1);
      }
    }
  }

  clear(): void {
    this.#replicas.clear();
    this.#byLogicalModel.clear();
    this.#byProvider.clear();
    this.#phases.clear();
  }
}
