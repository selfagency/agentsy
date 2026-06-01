export * from './adapters/index.js';
export * from './normalizers/index.js';
export * from './pipeline/index.js';
export * from './universal-client/index.js';

export interface ProviderRetryPolicy {
  backoffFactor: number;
  initialDelayMs: number;
  maxAttempts: number;
  maxDelayMs: number;
}

export interface ProviderCapabilities {
  batching?: boolean | undefined;
  budgeting?:
    | {
        supportsCostTracking?: boolean | undefined;
        supportsTokenBudgeting?: boolean | undefined;
      }
    | undefined;
  reasoning?: boolean | undefined;
  retry?: ProviderRetryPolicy | undefined;
  streaming?: boolean | undefined;
  toolCalling?: boolean | undefined;
}

export interface ProviderDefinition {
  capabilities?: ProviderCapabilities | undefined;
  id: string;
  name: string;
}

// Capability bridge exports
export * from './capability-bridge.js';
