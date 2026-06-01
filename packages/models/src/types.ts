/**
 * Modalities configuration for a model
 */
export interface ModelModalities {
  input: string[];
  output: string[];
}

/**
 * Cost structure for model usage
 */
export interface ModelCost {
  cache_read?: number;
  cache_write?: number;
  input: number;
  output: number;
}

/**
 * Limits configuration for a model
 */
export interface ModelLimits {
  context: number;
  output: number;
}

/**
 * Individual model definition from models.dev API
 */
export interface ModelsDevModel {
  attachment?: boolean;
  cost: ModelCost;
  family: string;
  id: string;
  knowledge?: string;
  last_updated: string;
  limit: ModelLimits;
  modalities: ModelModalities;
  name: string;
  open_weights: boolean;
  reasoning: boolean;
  release_date: string;
  temperature: boolean;
  tool_call: boolean;
}

/**
 * Provider information from models.dev API
 */
export interface ModelsDevProvider {
  api?: string;
  doc: string;
  env: readonly string[];
  id: string;
  models: Record<string, ModelsDevModel>;
  name: string;
  npm: string;
}

/**
 * The overall models.dev API structure
 */
export type ModelsDevAPI = Record<string, ModelsDevProvider>;

/**
 * Task requirements for model selection
 */
export interface TaskRequirements {
  capabilities?: {
    tool_calling?: boolean;
    streaming?: boolean;
    image_input?: boolean;
  };
  constraints?: {
    max_cost?: number;
    max_context?: number;
    exclude_family?: string[];
  };
  modality?: 'text' | 'multimodal' | 'code';
  specialization?: string;
}

/**
 * Result of model selection
 */
export interface ModelSelectionResult {
  capabilities: Record<string, boolean>;
  confidence: number;
  estimatedCost: number;
  model: string;
  provider: string;
  reasoning: string;
}

/**
 * Local system capabilities used for hardware-aware recommendation.
 */
export interface SystemCapabilities {
  backend?: 'cuda' | 'metal' | 'rocm' | 'sycl' | 'cpu' | 'unknown';
  cpuCores?: number;
  ramGb: number;
  unifiedMemory?: boolean;
  vramGb?: number;
}

/**
 * llm-stats/local benchmark data for a model candidate.
 */
export interface LLMStatsLocalModel {
  categoryScores?: Record<string, number>;
  estimatedTokensPerSecond?: number;
  isLocalCompatible?: boolean;
  minRamGb?: number;
  minVramGb?: number;
  modelId: string;
  quantization?: string;
  rankingScore?: number;
  recommendedRamGb?: number;
  recommendedVramGb?: number;
  runtime?: 'ollama' | 'llama.cpp' | 'vllm' | 'mlx' | 'docker-model-runner' | 'other';
}

export interface LocalRecommendationCriteria {
  minContext?: number;
  preferLowCost?: boolean;
  requireToolCalling?: boolean;
  taskCategory?: 'general' | 'coding' | 'reasoning' | 'chat' | 'multimodal';
  topN?: number;
}

export interface LocalModelRecommendation extends ModelSelectionResult {
  benchmarkScore: number;
  compositeScore: number;
  costScore: number;
  fitScore: number;
  quantization?: string;
  requiredRamGb: number;
  requiredVramGb: number;
  runtime?: string;
  speedScore: number;
}
