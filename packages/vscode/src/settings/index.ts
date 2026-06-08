export {
  getVSCodeSetupGuide,
  // fallow-ignore-next-line unused-type
  type RunVSCodeSettingsDiagnosticsOptions,
  runVSCodeSettingsDiagnostics
} from './diagnostics.js';
export type { SchemaProperty, SettingsSchema } from './schema-validator.js';
export { applyDefaults, validateSettings } from './schema-validator.js';
export { SettingsLoader } from './settings-loader.js';
