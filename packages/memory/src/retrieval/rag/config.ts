import type { RAGConfig, RAGWeightConfig } from './types.js';

export type CreateRAGConfigInput = Partial<Omit<RAGConfig, 'weights' | 'web'>> & {
  weights?: Partial<RAGWeightConfig>;
  web?: Partial<RAGConfig['web']>;
};

const DEFAULT_WEIGHTS: RAGWeightConfig = {
  entity: 0.2,
  lexical: 0.3,
  temporal: 0.1,
  vector: 0.4
};

function normalizeWeights(weights: Partial<RAGWeightConfig> | undefined): RAGWeightConfig {
  const merged: RAGWeightConfig = {
    entity: Math.max(0, weights?.entity ?? DEFAULT_WEIGHTS.entity),
    lexical: Math.max(0, weights?.lexical ?? DEFAULT_WEIGHTS.lexical),
    temporal: Math.max(0, weights?.temporal ?? DEFAULT_WEIGHTS.temporal),
    vector: Math.max(0, weights?.vector ?? DEFAULT_WEIGHTS.vector)
  };

  const sum = merged.vector + merged.lexical + merged.entity + merged.temporal;
  if (sum <= 0) {
    return { ...DEFAULT_WEIGHTS };
  }

  return {
    entity: merged.entity / sum,
    lexical: merged.lexical / sum,
    temporal: merged.temporal / sum,
    vector: merged.vector / sum
  };
}

export function createRAGConfig(input: CreateRAGConfigInput): RAGConfig {
  return {
    localOnly: input.localOnly ?? true,
    serverBaseUrl: input.serverBaseUrl ?? 'http://127.0.0.1:4318',
    timeoutMs: Math.max(200, input.timeoutMs ?? 3000),
    web: {
      allowHosts: [...(input.web?.allowHosts ?? [])],
      enabled: input.web?.enabled ?? false
    },
    weights: normalizeWeights(input.weights)
  };
}
