/**
 * Settings validation result.
 */
export interface SettingsValidationResult {
  errors?: string[];
  valid: boolean;
  warnings?: string[];
}

/**
 * Settings change event.
 */
export interface SettingsChangeEvent {
  key: string;
  newValue: unknown;
  oldValue: unknown;
}

/**
 * Settings change listener.
 */
export type SettingsChangeListener = (event: SettingsChangeEvent) => void;

export type { LoadedSettings, SettingsLoaderConfig } from './errors.js';
