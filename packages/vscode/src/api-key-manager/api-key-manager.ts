import type { ExtensionContext } from 'vscode';
import type { ApiKeyChangeListener, ApiKeyManagerConfig } from '../types/index.js';

/**
 * Centralized API key management with VS Code SecretStorage.
 * Provides secure storage, retrieval, and change notifications.
 */
export class ApiKeyManager {
  private readonly listeners: Set<ApiKeyChangeListener> = new Set();
  private apiKey: string | undefined;
  private isInitialized = false;

  constructor(
    private readonly context: ExtensionContext,
    private readonly config: ApiKeyManagerConfig
  ) {}

  /**
   * Initialize the manager and load stored API key.
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    this.apiKey = await this.context.secrets.get(this.config.secretKey);
    this.isInitialized = true;
    await this.setupContextVariable();
  }

  /**
   * Get the stored API key.
   */
  async getApiKey(): Promise<string | undefined> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    return this.apiKey;
  }

  /**
   * Check if an API key is stored.
   */
  async hasApiKey(): Promise<boolean> {
    const key = await this.getApiKey();
    return Boolean(key);
  }

  /**
   * Set a new API key with optional validation.
   */
  async setApiKey(key?: string): Promise<void> {
    let newKey = key;

    // If no key provided, prompt user
    if (!newKey) {
      newKey = await this.promptForApiKey();
      if (!newKey) {
        return; // User cancelled
      }
    }

    // Validate if validator provided
    if (this.config.validateBeforeStore) {
      try {
        const isValid = await this.config.validateBeforeStore(newKey);
        if (!isValid) {
          const error = new Error('API key validation failed');
          this.config.onError?.(error);
          throw error;
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.config.onError?.(err);
        throw err;
      }
    }

    // Store the key
    await this.context.secrets.store(this.config.secretKey, newKey);
    this.apiKey = newKey;

    // Update context and notify listeners
    await this.setupContextVariable();
    await this.setupHasKeyContext();
    this.notifyListeners('updated', newKey);
  }

  /**
   * Delete the stored API key.
   */
  async deleteApiKey(): Promise<void> {
    await this.context.secrets.delete(this.config.secretKey);
    this.apiKey = undefined;

    // Update context and notify listeners
    await this.setupContextVariable();
    await this.setupHasKeyContext();
    this.notifyListeners('deleted', undefined);
  }

  /**
   * Setup VS Code context variable for hasApiKey state.
   */
  async setupHasKeyContext(): Promise<void> {
    const hasKey = await this.hasApiKey();
    try {
      const { commands } = await import('vscode');
      await commands.executeCommand('setContext', this.config.contextKey, hasKey);
    } catch {
      // Gracefully ignore when vscode is unavailable (e.g., during tests)
    }
  }

  /**
   * Setup VS Code context variable.
   */
  async setupContextVariable(): Promise<void> {
    await this.setupHasKeyContext();
  }

  /**
   * Listen for API key changes.
   */
  onDidChangeApiKey(listener: ApiKeyChangeListener): { dispose(): void } {
    this.listeners.add(listener);
    return {
      dispose: () => {
        this.listeners.delete(listener);
      }
    };
  }

  /**
   * Stop listening for API key changes.
   */
  offDidChangeApiKey(listener: ApiKeyChangeListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Debug helper: Show currently stored API key (masked).
   */
  async _debugShowStoredKey(): Promise<string | undefined> {
    const key = await this.getApiKey();
    if (key) {
      const masked = key.substring(0, 4) + '*'.repeat(Math.max(0, key.length - 8)) + key.substring(key.length - 4);
      return masked;
    }
    return undefined;
  }

  /**
   * Prompt user for API key.
   */
  private async promptForApiKey(): Promise<string | undefined> {
    const input = await this.promptForInput(
      this.config.displayName,
      this.config.promptMessage || `Enter your ${this.config.displayName}:`,
      true
    );
    return input;
  }

  /**
   * Show input prompt.
   */
  private async promptForInput(_title: string, prompt: string, password: boolean): Promise<string | undefined> {
    try {
      const { window } = await import('vscode');
      return await window.showInputBox({
        prompt,
        password,
        ignoreFocusOut: true
      });
    } catch {
      // Gracefully ignore when vscode is unavailable (e.g., during tests)
      return undefined;
    }
  }

  /**
   * Notify all listeners of API key changes.
   */
  private notifyListeners(event: 'changed' | 'deleted' | 'updated', newKey: string | undefined): void {
    for (const listener of this.listeners) {
      try {
        listener(event, newKey);
      } catch (error) {
        // Log but don't throw - other listeners should still be called
        console.error('Error in ApiKeyManager listener:', error);
      }
    }
  }

  /**
   * Dispose and cleanup.
   */
  dispose(): void {
    this.listeners.clear();
    this.apiKey = undefined;
  }
}
