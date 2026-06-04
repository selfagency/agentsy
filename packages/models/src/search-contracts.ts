export interface ModelSearchQuery {
  maxPricePer1mInputUsd?: number;
  minContextWindow?: number;
  preferLocal?: boolean;
  providerIds?: string[];
  supportsEmbeddings?: boolean;
  supportsStreaming?: boolean;
  supportsTools?: boolean;
  text?: string;
}

export interface RecommendationCriteria {
  budgetTier?: 'low' | 'mid' | 'high';
  minBenchmarks?: Record<string, number>;
  preferLocal?: boolean;
  preferredLicenses?: string[];
  task: 'coding' | 'math' | 'writing' | 'general' | 'multimodal' | 'reasoning';
}

export interface ModelRefinementRequest {
  baseSelectionId?: string;
  relax?: Array<'cost' | 'latency' | 'quality' | 'privacy' | 'tooling'>;
  task?: RecommendationCriteria['task'];
  tighten?: Array<'cost' | 'latency' | 'quality' | 'privacy' | 'tooling'>;
}

export interface ModelSearchResult {
  modelId: string;
  providerId?: string;
  reason: string;
  score: number;
}

export interface SelectionCriteria {
  capabilities?: string[];
  local?: boolean;
  maxCost?: number;
  minTokens?: number;
}

export interface ModelSelection {
  criteria?: SelectionCriteria;
  modelId: string;
  providerId: string;
}

export function selectModel(criteria: SelectionCriteria = {}): ModelSelection {
  const normalizedCapabilities = criteria.capabilities?.map(capability => capability.trim()).filter(Boolean) ?? [];

  const providerId = criteria.local === true ? 'local' : 'openai';
  const modelId = normalizedCapabilities.includes('tool-use') ? 'gpt-4o-mini' : 'gpt-4.1-mini';

  return {
    criteria: {
      ...criteria,
      ...(normalizedCapabilities.length > 0 ? { capabilities: normalizedCapabilities } : {})
    },
    modelId,
    providerId
  };
}

export function selectModelForProvider(providerId: string, criteria: SelectionCriteria = {}): string {
  return selectModel({ ...criteria, local: providerId === 'local' }).modelId;
}

export function normalizeModelSearchQuery(query: ModelSearchQuery): ModelSearchQuery {
  const normalized: ModelSearchQuery = {};

  const text = query.text?.trim();
  if (text) {
    normalized.text = text;
  }

  const providerIds = query.providerIds?.map(providerId => providerId.trim()).filter(Boolean);
  if (providerIds && providerIds.length > 0) {
    normalized.providerIds = [...new Set(providerIds)];
  }

  if (query.maxPricePer1mInputUsd !== undefined) {
    normalized.maxPricePer1mInputUsd = query.maxPricePer1mInputUsd;
  }

  if (query.preferLocal !== undefined) {
    normalized.preferLocal = query.preferLocal;
  }

  if (query.minContextWindow !== undefined) {
    normalized.minContextWindow = query.minContextWindow;
  }

  if (query.supportsEmbeddings !== undefined) {
    normalized.supportsEmbeddings = query.supportsEmbeddings;
  }

  if (query.supportsStreaming !== undefined) {
    normalized.supportsStreaming = query.supportsStreaming;
  }

  if (query.supportsTools !== undefined) {
    normalized.supportsTools = query.supportsTools;
  }

  return normalized;
}

export function mergeModelRefinementRequest(
  base: RecommendationCriteria,
  request: ModelRefinementRequest
): RecommendationCriteria & ModelRefinementRequest {
  return {
    ...base,
    ...request
  };
}

export function searchModels(query: ModelSearchQuery): ModelSearchResult[] {
  const normalized = normalizeModelSearchQuery(query);
  const term = normalized.text?.toLowerCase() ?? '';

  if (term.length === 0) {
    return [];
  }

  const providerId = normalized.providerIds?.[0];
  const result: ModelSearchResult = {
    modelId: term,
    reason: normalized.preferLocal ? 'prefer local' : 'keyword match',
    score: normalized.preferLocal ? 0.95 : 0.75
  };

  if (providerId !== undefined) {
    result.providerId = providerId;
  }

  return [result];
}
