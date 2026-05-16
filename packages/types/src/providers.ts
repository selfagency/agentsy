/**
 * Provider integration types.
 */

import type { ToolId } from "./brands.js";

/**
 * Capabilities offered by a model provider.
 */
export interface ProviderCapabilities {
  /** Maximum tokens supported in prompt. */
  maxPromptTokens?: number;

  /** Maximum tokens supported in completion. */
  maxCompletionTokens?: number;

  /** Whether the provider supports streaming responses. */
  supportsStreaming?: boolean;

  /** Whether the provider supports function/tool calling. */
  supportsTools?: boolean;

  /** Whether the provider supports JSON mode. */
  supportsJsonMode?: boolean;

  /** Whether the provider supports image inputs. */
  supportsImages?: boolean;

  /** Whether the provider supports code execution. */
  supportsCodeExecution?: boolean;

  /** Optional timeout override in milliseconds. */
  timeoutMs?: number;
}

/**
 * Retry policy for provider requests.
 */
export interface ProviderRetryPolicy {
  /** Number of retry attempts. */
  attempts: number;

  /** Backoff strategy: 'fixed', 'exponential', 'exponential_with_jitter'. */
  backoff: "fixed" | "exponential" | "exponential_with_jitter";

  /** Initial backoff delay in milliseconds. */
  initialMs: number;

  /** Status codes that trigger retry. */
  retryableStatusCodes?: number[];
}

/**
 * Configuration for a specific provider integration.
 */
export interface ProviderDefinition {
  /** Provider identifier (e.g., 'anthropic', 'openai', 'openrouter'). */
  name: string;

  /** Base URL for API requests. */
  baseUrl: string;

  /** API key for authentication. */
  apiKey: string;

  /** Optional: organization ID. */
  organizationId?: string;

  /** Capabilities of this provider. */
  capabilities: ProviderCapabilities;

  /** Retry policy for requests. */
  retryPolicy?: ProviderRetryPolicy;

  /** Optional custom headers. */
  headers?: Record<string, string>;

  /** Optional default model name. */
  defaultModel?: string;
}

/**
 * Interface for a tool exposed to a provider.
 */
export interface ProviderTool {
  /** Unique tool identifier. */
  id: ToolId;

  /** Tool name as expected by the provider. */
  name: string;

  /** TypeScript-style parameter schema. */
  parameters: Record<string, unknown>;

  /** Tool description. */
  description: string;

  /** Tool handler function. */
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}
