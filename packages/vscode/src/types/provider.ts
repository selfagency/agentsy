import type { ProviderConfig } from './errors.js';

/**
 * Configuration for a VS Code extension provider.
 */
export interface ExtensionProviderConfig extends ProviderConfig {
  /** Extension activation events */
  activationEvents?: string[];

  /** Extension commands */
  commands?: {
    command: string;
    title: string;
    category?: string;
  }[];

  /** Configuration schema */
  configurationSchema?: Record<string, unknown>;
}

/**
 * Provider lifecycle hooks.
 */
export interface IProviderLifecycle {
  onActivate(): Promise<void>;
  onDeactivate(): Promise<void>;
  onConnect(): Promise<void>;
  onDisconnect(): Promise<void>;
}
