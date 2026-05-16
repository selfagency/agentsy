/**
 * Events emitted by ApiKeyManager.
 */
export type ApiKeyEvent = "changed" | "deleted" | "updated";

/**
 * Listener for API key changes.
 */
export type ApiKeyChangeListener = (
  event: ApiKeyEvent,
  newKey: string | undefined
) => void;

/**
 * Storage provider interface for API keys.
 */
export interface IApiKeyStorage {
  get(key: string): Promise<string | undefined>;
  store(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

/**
 * API key validation result.
 */
export interface ApiKeyValidationResult {
  valid: boolean;
  error?: string;
}
