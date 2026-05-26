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
  streaming?: boolean | undefined;
  toolCalling?: boolean | undefined;
  batching?: boolean | undefined;
  reasoning?: boolean | undefined;
  retry?: ProviderRetryPolicy | undefined;
  budgeting?:
    | {
        supportsCostTracking?: boolean | undefined;
        supportsTokenBudgeting?: boolean | undefined;
      }
    | undefined;
}

export interface ProviderDefinition {
  id: string;
  name: string;
  capabilities?: ProviderCapabilities | undefined;
}

// Capability bridge exports
export * from './capability-bridge.js';
