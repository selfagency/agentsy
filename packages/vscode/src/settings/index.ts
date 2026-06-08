export {
  getVSCodeSetupGuide,
  type RunVSCodeSettingsDiagnosticsOptions,
  runVSCodeSettingsDiagnostics
} from './diagnostics.js';
export type { SchemaProperty, SettingsSchema } from './schema-validator.js';
export { applyDefaults, validateSettings } from './schema-validator.js';
export { SettingsLoader } from './settings-loader.js';
