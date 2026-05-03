/**
 * Settings validation result.
 */
export interface SettingsValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
}

/**
 * Settings change event.
 */
export interface SettingsChangeEvent {
  key: string;
  oldValue: unknown;
  newValue: unknown;
}

/**
 * Settings change listener.
 */
export type SettingsChangeListener = (event: SettingsChangeEvent) => void;

export { type SettingsLoaderConfig, type LoadedSettings } from './errors.js';
