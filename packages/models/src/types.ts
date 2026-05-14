// Core types for model selection and task requirements

export interface ModelsDevAPI {
  [providerId: string]: ModelsDevProvider;
}

export interface ModelsDevProvider {
  id: string;
  env: string[];
  npm?: string;
  api: string;
  name: string;
  doc: string;
  models: Record<string, ModelsDevModel>;
}

export interface ModelsDevModel {
  id: string;
  name: string;
  family: string;
  attachment: boolean;
  reasoning: boolean;
  tool_call: boolean;
  temperature: boolean;
  knowledge: string;
  release_date: string;
  last_updated: string;
  modalities: {
    input: string[];
    output: string[];
  };
  open_weights: boolean;
  limit: {
    context: number;
    output: number;
  };
  cost: {
    input: number;
    output: number;
    cache_read?: number;
    cache_write?: number;
  };
}

// Task requirements for model selection
export interface TaskRequirements {
  modality?: 'text' | 'multimodal' | 'code' | 'reasoning';
  capabilities?: {
    tool_calling?: boolean;
    streaming?: boolean;
    image_input?: boolean;
    audio_input?: boolean;
    audio_output?: boolean;
  };
  constraints?: {
    max_cost?: number;
    max_context?: number;
    min_speed?: 'fast' | 'medium' | 'slow';
    preferred_family?: string;
    exclude_family?: string[];
  };
  specialization?: string;
}

// Model selection results
export interface ModelSelectionResult {
  model: string;
  provider: string;
  confidence: number;
  estimatedCost: number;
  capabilities: TaskRequirements['capabilities'];
  reasoning: string;
}
