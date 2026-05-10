/**
 * @agentsy/providers
 *
 * Provider capability matrix, adapters (consolidated: adapters)
 *
 * This package consolidates adapter functionality and provides a unified
 * interface for working with different LLM providers and their capabilities.
 */

export interface ProviderCapabilities {
  supportsStreaming: boolean;
  supportsFunctionCalling: boolean;
  supportsStructuredOutput: boolean;
  maxTokens: number;
  supportedModels: string[];
}

export interface ProviderAdapter {
  readonly name: string;
  readonly capabilities: ProviderCapabilities;

  /**
   * Initialize the provider adapter with the given configuration.
   */
  initialize(config: unknown): Promise<void>;

  /**
   * Close the adapter and release any resources.
   */
  close(): Promise<void>;
}

/**
 * Creates a provider adapter for the specified provider name.
 */
export function createProviderAdapter(_name: string): ProviderAdapter | null {
  // Placeholder implementation - will be expanded as adapters are consolidated
  return null;
}

/**
 * Gets the capabilities matrix for all supported providers.
 */
export function getProviderCapabilitiesMatrix(): Record<string, ProviderCapabilities> {
  // Placeholder implementation
  return {};
}
