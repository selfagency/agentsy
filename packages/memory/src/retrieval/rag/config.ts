import type { RAGConfig, RAGWeightConfig } from './types.js';

export type CreateRAGConfigInput = Partial<Omit<RAGConfig, 'weights' | 'web'>> & {
  weights?: Partial<RAGWeightConfig>;
  web?: Partial<RAGConfig['web']>;
};

const DEFAULT_WEIGHTS: RAGWeightConfig = {
  vector: 0.4,
  lexical: 0.3,
  entity: 0.2,
  temporal: 0.1
};

function normalizeWeights(weights: Partial<RAGWeightConfig> | undefined): RAGWeightConfig {
  const merged: RAGWeightConfig = {
    vector: Math.max(0, weights?.vector ?? DEFAULT_WEIGHTS.vector),
    lexical: Math.max(0, weights?.lexical ?? DEFAULT_WEIGHTS.lexical),
    entity: Math.max(0, weights?.entity ?? DEFAULT_WEIGHTS.entity),
    temporal: Math.max(0, weights?.temporal ?? DEFAULT_WEIGHTS.temporal)
  };

  const sum = merged.vector + merged.lexical + merged.entity + merged.temporal;
  if (sum <= 0) {
    return { ...DEFAULT_WEIGHTS };
  }

  return {
    vector: merged.vector / sum,
    lexical: merged.lexical / sum,
    entity: merged.entity / sum,
    temporal: merged.temporal / sum
  };
}

export function createRAGConfig(input: CreateRAGConfigInput): RAGConfig {
  return {
    localOnly: input.localOnly ?? true,
    serverBaseUrl: input.serverBaseUrl ?? 'http://127.0.0.1:4318',
    timeoutMs: Math.max(200, input.timeoutMs ?? 3_000),
    weights: normalizeWeights(input.weights),
    web: {
      enabled: input.web?.enabled ?? false,
      allowHosts: [...(input.web?.allowHosts ?? [])]
    }
  };
}
