/**
 * Gateway-facing headroom provider. Abstracts the tokenomics
 * internals behind a simple API that the gateway's
 * replica selector calls during routing decisions.
 */

import type { ReplicaHeadroomSnapshot } from '../quotas/headroom.js';
import type { UsageAggregator } from '../quotas/usage-aggregator.js';

export interface ReplicaHeadroomProvider {
  getReplicaHeadroom(replicaId: string): Promise<ReplicaHeadroomSnapshot | undefined>;
}

export function createReplicaHeadroomProvider(aggregator: UsageAggregator): ReplicaHeadroomProvider {
  return {
    getReplicaHeadroom(replicaId) {
      return Promise.resolve(aggregator.getHeadroomSnapshot(replicaId));
    }
  };
}
