// Note: Zod schemas are available but not exported due to dependency constraints
// Uncomment the following lines if Zod dependency is properly configured
// import { z } from 'zod';

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
 * Zod schemas for validation (available when zod is properly configured)
 * Uncomment when Zod dependency is available
 */
/*
export const ModelModalitiesSchema = z.object({
  input: z.array(z.string()),
  output: z.array(z.string()),
});

export const ModelCostSchema = z.object({
  input: z.number(),
  output: z.number(),
  cache_read: z.number().optional(),
  cache_write: z.number().optional(),
});

export const ModelLimitsSchema = z.object({
  context: z.number(),
  output: z.number(),
});

export const ModelsDevModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  family: z.string(),
  attachment: z.boolean().optional(),
  reasoning: z.boolean(),
  tool_call: z.boolean(),
  temperature: z.boolean(),
  knowledge: z.string(),
  release_date: z.string(),
  last_updated: z.string(),
  modalities: ModelModalitiesSchema,
  open_weights: z.boolean(),
  limit: ModelLimitsSchema,
  cost: ModelCostSchema,
});

export const ModelsDevProviderSchema = z.object({
  id: z.string(),
  env: z.array(z.string()),
  npm: z.string(),
  name: z.string(),
  doc: z.string(),
  models: z.record(z.string(), ModelsDevModelSchema),
});

export const ModelsDevAPISchema = z.record(z.string(), ModelsDevProviderSchema);
*/