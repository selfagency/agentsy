export * from './adapters/index.js';
export * from './normalizers/index.js';
export * from './pipeline/index.js';
export * from './universal-client/index.js';

export interface ProviderRetryPolicy {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffFactor: number;
}

export interface ProviderCapabilities {
  streaming?: boolean;
  toolCalling?: boolean;
  batching?: boolean;
  reasoning?: boolean;
  retry?: ProviderRetryPolicy;
  budgeting?: {
    supportsCostTracking?: boolean;
    supportsTokenBudgeting?: boolean;
  };
}

export interface ProviderDefinition {
  id: string;
  name: string;
  capabilities?: ProviderCapabilities;
}
