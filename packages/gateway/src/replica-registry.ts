/**
 * ReplicaRegistry — stores `ModelReplica` entries indexed by
 * `logicalModelId` and `providerId`.
 *
 * A replica is one way to reach a logical model through a specific
 * provider/account. Multiple replicas may serve the same logical
 * model (e.g. anthropic-main + anthropic-secondary both serving
 * claude-sonnet-4).
 */

import type { ModelReplica } from './types.js';

export class ReplicaRegistry {
  readonly #replicas = new Map<string, ModelReplica>();
  readonly #byLogicalModel = new Map<string, ModelReplica[]>();
  readonly #byProvider = new Map<string, ModelReplica[]>();

  register(replica: ModelReplica): void {
    this.#replicas.set(replica.id, replica);

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

  remove(id: string): void {
    const replica = this.#replicas.get(id);
    if (replica === undefined) {
      return;
    }

    this.#replicas.delete(id);

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
  }
}
