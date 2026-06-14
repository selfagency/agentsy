import type { DiagnosticReport, SetupGuide } from './types.js';

async function runConfigDiagnostics(): Promise<DiagnosticReport> {
  const { loadConfig: loadCfg } = await import('../config/index.js');
  const checks: import('./types.js').DiagnosticCheck[] = [];
  try {
    const config = await loadCfg();
    checks.push({ id: 'config-loaded', level: 'info', message: 'Configuration loaded successfully.' });
    checks.push({ id: 'config-version', level: 'info', message: `Config schema version: ${config.version}` });
    if (config.providers.length === 0) {
      checks.push({ id: 'no-providers', level: 'warn', message: 'Use `agentsy settings` to add a provider.' });
    }
    for (const provider of config.providers) {
      if (provider.secretRef || provider.secretId) {
        continue;
      }
      checks.push({
        id: `provider-${provider.id}-no-secret`,
        level: 'warn',
        message: `Provider "${provider.id}" has no secretRef or secretId.`
      });
    }
    if (config.budget.inputCap <= 0 || config.budget.outputCap <= 0) {
      checks.push({ id: 'budget-invalid', level: 'error', message: 'Budget caps must be positive numbers.' });
    }
  } catch (error) {
    checks.push({
      id: 'config-error',
      level: 'error',
      message: `Failed to load configuration: ${error instanceof Error ? error.message : String(error)}`
    });
  }
  let status: 'pass' | 'warn' | 'fail' = 'pass';
  if (checks.some(c => c.level === 'error')) {
    status = 'fail';
  } else if (checks.some(c => c.level === 'warn')) {
    status = 'warn';
  }
  return { target: 'config', status, summary: `Config diagnostics: ${status}`, checks };
}

function getConfigSetupGuide(): SetupGuide {
  return {
    target: 'config',
    summary: 'Configure providers, models, and preferences.',
    steps: [
      'Run `agentsy settings` to create a default user config.',
      'Edit ~/.config/agentsy/config.json to add provider entries.',
      'Set AGENTSY_OPENAI_KEY or AGENTSY_ANTHROPIC_KEY env vars for local dev.',
      'Run `agentsy doctor config` to validate the configuration.',
      'Run `agentsy config` to view the merged configuration.'
    ]
  };
}

export { getConfigSetupGuide, runConfigDiagnostics };
