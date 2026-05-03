import type { SettingsLoaderConfig, LoadedSettings } from '../types/errors.js';
import type { SettingsChangeListener, SettingsChangeEvent, SettingsValidationResult } from '../types/settings.js';
import { validateSettings, applyDefaults } from './schema-validator.js';

/**
 * Loads, validates, and watches VS Code workspace configuration.
 * Uses dynamic import to avoid hard vscode dependency at module load time.
 */
export class SettingsLoader {
  private readonly disposables: Array<{ dispose(): void }> = [];
  private readonly listeners = new Set<SettingsChangeListener>();
  private cachedSettings: LoadedSettings = {};

  constructor(private readonly config: SettingsLoaderConfig) {}

  /**
   * Load and validate current settings from the workspace.
   * Falls back to defaults when VS Code is unavailable (e.g., in tests).
   */
  async load(): Promise<LoadedSettings> {
    const raw = await this.readRawSettings();
    const merged = this.config.defaults ? applyDefaults(raw, this.config.defaults) : raw;

    if (this.config.schema && Object.keys(this.config.schema).length > 0) {
      validateSettings(merged, this.config.schema);
    }

    this.cachedSettings = merged;
    return merged;
  }

  /**
   * Validate settings without loading from VS Code.
   */
  validate(settings: Record<string, unknown>): SettingsValidationResult {
    if (!this.config.schema) {
      return { valid: true };
    }
    return validateSettings(settings, this.config.schema);
  }

  /**
   * Get a single setting value by key.
   * Reads from cache; call load() first to populate.
   */
  get<T>(key: string, fallback?: T): T | undefined {
    const value = this.cachedSettings[key];
    if (value === undefined || value === null) return fallback;
    return value as T;
  }

  /**
   * Register a listener for settings changes.
   * Returns a disposable to unregister.
   */
  onDidChange(listener: SettingsChangeListener): { dispose(): void } {
    this.listeners.add(listener);
    return {
      dispose: () => this.listeners.delete(listener),
    };
  }

  /**
   * Start watching VS Code configuration changes.
   * No-op if VS Code is unavailable.
   */
  async watch(): Promise<void> {
    try {
      const vscode = await import('vscode');
      const disposable = vscode.workspace.onDidChangeConfiguration(async e => {
        if (e.affectsConfiguration(this.config.namespace)) {
          const oldSettings = { ...this.cachedSettings };
          const newSettings = await this.load();
          this.notifyListeners(oldSettings, newSettings);
        }
      });
      this.disposables.push(disposable);
    } catch {
      // VS Code not available — watch is a no-op
    }
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.disposables.length = 0;
    this.listeners.clear();
  }

  private async readRawSettings(): Promise<Record<string, unknown>> {
    try {
      const vscode = await import('vscode');
      const cfg = vscode.workspace.getConfiguration(this.config.namespace);
      const result: Record<string, unknown> = {};

      if (this.config.schema?.properties) {
        for (const key of Object.keys(this.config.schema.properties)) {
          const value = cfg.get(key);
          if (value !== undefined) result[key] = value;
        }
      }

      return result;
    } catch {
      return {};
    }
  }

  private notifyListeners(oldSettings: LoadedSettings, newSettings: LoadedSettings): void {
    const allKeys = new Set([...Object.keys(oldSettings), ...Object.keys(newSettings)]);

    for (const key of allKeys) {
      const oldValue = oldSettings[key];
      const newValue = newSettings[key];
      if (oldValue !== newValue) {
        const event: SettingsChangeEvent = { key, oldValue, newValue };
        for (const listener of this.listeners) {
          listener(event);
        }
      }
    }
  }
}
