import type { LanguageModelChatProvider } from 'vscode';

/**
 * Error codes standardized across all providers.
 * Maps to VS Code LanguageModelError codes.
 */
export enum ProviderErrorCode {
  InvalidApiKey = 'invalid_api_key',
  RateLimited = 'rate_limited',
  ModelNotFound = 'model_not_found',
  ContextLengthExceeded = 'context_length_exceeded',
  ConnectionError = 'connection_error',
  Timeout = 'timeout',
  InvalidRequest = 'invalid_request',
  InternalError = 'internal_error',
  NotImplemented = 'not_implemented',
  Cancelled = 'cancelled',
}

/**
 * User-friendly messages for each error code.
 */
export const ErrorCodeToMessage: Record<ProviderErrorCode, string> = {
  [ProviderErrorCode.InvalidApiKey]: 'Invalid API key. Please check your credentials in settings.',
  [ProviderErrorCode.RateLimited]: 'Rate limited. Please wait a moment and try again.',
  [ProviderErrorCode.ModelNotFound]: 'Model not found. Please check your model configuration.',
  [ProviderErrorCode.ContextLengthExceeded]:
    'Context length exceeded. Please reduce your message length or use a model with more context.',
  [ProviderErrorCode.ConnectionError]: 'Connection failed. Please check your network and provider URL.',
  [ProviderErrorCode.Timeout]: 'Request timed out. Please try again.',
  [ProviderErrorCode.InvalidRequest]: 'Invalid request. Please check your input format.',
  [ProviderErrorCode.InternalError]: 'Internal server error. Please try again.',
  [ProviderErrorCode.NotImplemented]: 'Feature not implemented by this provider.',
  [ProviderErrorCode.Cancelled]: 'Request was cancelled.',
};

/**
 * Configuration for BaseLanguageModelChatProvider.
 */
export interface ProviderConfig {
  /** Unique identifier for this provider (e.g., 'selfagency-opilot') */
  providerId: string;

  /** Vendor name (e.g., 'Ollama') */
  vendor: string;

  /** Provider family (e.g., 'Ollama') */
  family: string;

  /** Display name shown in UI (e.g., 'Ollama') */
  displayName: string;

  /** Maximum input tokens supported */
  maxInputTokens: number;

  /** Supported capabilities */
  supportedCapabilities?: ('thinking' | 'vision' | 'tool-calls')[];

  /** Optional API key secret name for ApiKeyManager */
  apiKeySecretName?: string;
}

/**
 * Provider-specific API request format.
 * Subclasses return this from buildRequest().
 */
export interface ProviderApiRequest {
  /** Target API endpoint URL */
  url?: string;

  /** HTTP method */
  method: 'POST' | 'GET' | 'PUT' | 'DELETE';

  /** Request headers */
  headers: Record<string, string>;

  /** Request body (JSON) */
  body?: unknown;

  /** Optional request timeout in milliseconds */
  timeout?: number;
}

/**
 * Provider-specific streaming chunk format.
 * Each provider emits a different chunk type.
 */
export interface ProviderStreamChunk {
  [key: string]: unknown;
}

/**
 * API key manager configuration.
 */
export interface ApiKeyManagerConfig {
  /** Secret storage key (e.g., 'OLLAMA_API_KEY') */
  secretKey: string;

  /** VS Code context key for hasKey state (e.g., 'opilot.hasApiKey') */
  contextKey: string;

  /** Display name for prompts (e.g., 'Ollama API Key') */
  displayName: string;

  /** Optional prompt message when requesting key */
  promptMessage?: string;

  /** Optional validation function */
  validateBeforeStore?: (key: string) => boolean | Promise<boolean>;

  /** Optional error handler */
  onError?: (error: Error) => void;
}

/**
 * Usage quota information.
 */
export interface UsageQuota {
  /** Tokens or credits used */
  used: number;

  /** Total limit */
  total: number;

  /** Unit of measurement */
  unit: 'tokens' | 'credits' | 'requests';

  /** Time window */
  window: 'hourly' | 'daily' | 'weekly' | 'monthly';

  /** Percentage used (0-1) */
  percentUsed: number;

  /** When the quota resets */
  expiresAt?: Date;
}

/**
 * Data source for quota information.
 * Implement this to provide usage data for UsageStatusBar.
 */
export interface IQuotaDataSource {
  /** Get current quota information */
  getQuota(): Promise<UsageQuota>;

  /** Refresh quota information from API */
  refreshQuota(): Promise<UsageQuota>;

  /** Optional cleanup */
  dispose?(): void;
}

/**
 * Usage status bar configuration.
 */
export interface UsageStatusBarConfig {
  /** Display name in status bar (e.g., 'Z.ai Usage') */
  displayName: string;

  /** Optional tooltip template with {{used}}, {{total}}, {{percent}} */
  tooltipTemplate?: string;

  /** Warning threshold (0-1), e.g., 0.8 for 80% */
  warningThreshold?: number;

  /** Error threshold (0-1), e.g., 0.95 for 95% */
  errorThreshold?: number;

  /** Refresh interval in milliseconds (default: 60000) */
  refreshIntervalMs?: number;

  /** Optional refresh callback */
  onClickRefresh?: () => Promise<void>;

  /** Data source for quota information */
  quotaDataSource: IQuotaDataSource;

  /** Optional color scheme */
  colorScheme?: {
    normal: string;
    warning: string;
    error: string;
  };
}

/**
 * MCP server definition.
 */
export interface McpServerDefinition {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  headers?: Record<string, string>;
  disabled?: boolean;
  alwaysAllow?: boolean;
}

/**
 * Configuration for McpServerRegistry.
 */
export interface McpServerRegistryConfig {
  /** Namespace in settings (e.g., 'zModels.mcpServers') */
  namespace: string;

  /** Providers for dynamic servers */
  providers?: McpServerProvider[];

  /** Auto-register on activation */
  autoRegister?: boolean;
}

/**
 * Provider function for dynamic MCP servers.
 */
export interface McpServerProvider {
  provide(): Promise<McpServerDefinition[]>;
}

/**
 * Settings loader configuration.
 */
export interface SettingsLoaderConfig {
  /** Extension namespace (e.g., 'opilot') */
  namespace: string;

  /** JSON schema for validation */
  schema: Record<string, unknown>;

  /** Default values */
  defaults?: Record<string, unknown>;
}

/**
 * Loaded and validated settings.
 */
export interface LoadedSettings {
  [key: string]: unknown;
}

/**
 * Export interface for providers.
 * Implement this to create a provider instance.
 */
export interface IProviderAdapter extends LanguageModelChatProvider {
  // LanguageModelChatProvider implementation required
}
