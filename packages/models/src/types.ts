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
  input: number;
  output: number;
  cache_read?: number;
  cache_write?: number;
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
  id: string;
  name: string;
  family: string;
  attachment?: boolean;
  reasoning: boolean;
  tool_call: boolean;
  temperature: boolean;
  knowledge: string;
  release_date: string;
  last_updated: string;
  modalities: ModelModalities;
  open_weights: boolean;
  limit: ModelLimits;
  cost: ModelCost;
}

/**
 * Provider information from models.dev API
 */
export interface ModelsDevProvider {
  id: string;
  env: readonly string[];
  npm: string;
  name: string;
  doc: string;
  models: Record<string, ModelsDevModel>;
}

/**
 * The overall models.dev API structure
 */
export type ModelsDevAPI = Record<string, ModelsDevProvider>;

/**
 * Task requirements for model selection
 */
export interface TaskRequirements {
  modality?: 'text' | 'multimodal' | 'code';
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
  specialization?: string;
}

/**
 * Result of model selection
 */
export interface ModelSelectionResult {
  model: string;
  provider: string;
  confidence: number;
  estimatedCost: number;
  capabilities: Record<string, boolean>;
  reasoning: string;
}

/**
 * Local system capabilities used for hardware-aware recommendation.
 */
export interface SystemCapabilities {
  ramGb: number;
  vramGb?: number;
  cpuCores?: number;
  backend?: 'cuda' | 'metal' | 'rocm' | 'sycl' | 'cpu' | 'unknown';
  unifiedMemory?: boolean;
}

/**
 * llm-stats/local benchmark data for a model candidate.
 */
export interface LLMStatsLocalModel {
  modelId: string;
  categoryScores?: Record<string, number>;
  rankingScore?: number;
  minRamGb?: number;
  minVramGb?: number;
  recommendedRamGb?: number;
  recommendedVramGb?: number;
  estimatedTokensPerSecond?: number;
  runtime?: 'ollama' | 'llama.cpp' | 'vllm' | 'mlx' | 'docker-model-runner' | 'other';
  quantization?: string;
  isLocalCompatible?: boolean;
}

export interface LocalRecommendationCriteria {
  taskCategory?: 'general' | 'coding' | 'reasoning' | 'chat' | 'multimodal';
  requireToolCalling?: boolean;
  minContext?: number;
  preferLowCost?: boolean;
  topN?: number;
}

export interface LocalModelRecommendation extends ModelSelectionResult {
  fitScore: number;
  benchmarkScore: number;
  speedScore: number;
  costScore: number;
  compositeScore: number;
  requiredRamGb: number;
  requiredVramGb: number;
  runtime?: string;
  quantization?: string;
}
