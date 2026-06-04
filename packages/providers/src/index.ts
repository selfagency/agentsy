export * from './adapters/index.js';
export * from './normalizers/index.js';
export * from './pipeline/index.js';
export * from './profiles/index.js';
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

export type { CachePromptInput, CachePromptPlan } from './cache-prompt.js';
export { createCachePromptPlan } from './cache-prompt.js';
export type { AnthropicCacheConfig, AnthropicCachePrompt } from './caching/anthropic.js';
export { applyAnthropicPromptCaching } from './caching/anthropic.js';
export type { OpenAIPromptCaching } from './caching/openai.js';
export { applyOpenAIPromptCaching } from './caching/openai.js';
export type { ZaiPromptCaching } from './caching/zai.js';
export { applyZaiPromptCaching } from './caching/zai.js';
// Capability bridge exports
export * from './capability-bridge.js';
