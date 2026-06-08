import type { VSCodeSettingsDiagnosticsReport } from '../types/settings.js';
import type { SettingsSchema } from './schema-validator.js';
import { validateSettings } from './schema-validator.js';

export interface RunVSCodeSettingsDiagnosticsOptions {
  schema?: SettingsSchema;
  settings?: Record<string, unknown>;
}

export function runVSCodeSettingsDiagnostics(
  options: RunVSCodeSettingsDiagnosticsOptions = {}
): VSCodeSettingsDiagnosticsReport {
  const settings = options.settings ?? {};
  const schema = options.schema ?? {};
  const validation = validateSettings(settings, schema);
  const checks = [
    {
      id: 'settings-surface',
      level: 'info' as const,
      message: 'VS Code settings validation helpers are available.'
    },
    ...(validation.valid
      ? [
          {
            id: 'schema-validation',
            level: 'info' as const,
            message: 'Provided settings satisfy the configured schema.'
          }
        ]
      : (validation.errors ?? []).map(error => ({
          id: 'schema-validation',
          level: 'error' as const,
          message: error
        })))
  ];

  return {
    checks,
    status: validation.valid ? 'pass' : 'fail',
    summary: validation.valid
      ? 'VS Code settings schema validation passed.'
      : 'VS Code settings schema validation reported errors.',
    target: 'vscode'
  };
}

export function getVSCodeSetupGuide(): { steps: string[]; summary: string; target: 'vscode' } {
  return {
    target: 'vscode',
    summary: 'Configure VS Code settings, provider credentials, and optional MCP registration.',
    steps: [
      'Create or update your extension settings namespace and schema defaults.',
      'Configure provider credentials using ApiKeyManager or SecretStorage integration.',
      'Register any required MCP server definitions through the VS Code MCP helpers.',
      'Run `agentsy doctor vscode` to validate the current settings surface.'
    ]
  };
}
