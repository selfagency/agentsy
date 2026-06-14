/**
 * Config CLI commands — /config and /settings.
 *
 * ## Usage
 *
 * ```bash
 * agentsy config              # Print current config (merged)
 * agentsy config --json       # Print as JSON
 * agentsy config path          # Print config file paths
 * agentsy settings             # Interactive settings wizard
 * ```
 */

import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { type Config, loadConfig, userConfigPath } from '../config/index.js';
import type { CliIO } from '../index.js';

// =============================================================================
// Helpers
// =============================================================================

function formatConfig(config: Config): string[] {
  const lines: string[] = ['Current configuration (merged):', ''];

  lines.push(
    `  version: ${config.version}`,
    `  model: ${config.model ?? '(not set)'}`,
    `  approvalPolicy: ${config.approvalPolicy}`,
    `  defaultAgent: ${config.defaultAgent ?? '(not set)'}`,
    '',
    '  budget:',
    `    inputCap: ${config.budget.inputCap.toLocaleString()}`,
    `    outputCap: ${config.budget.outputCap.toLocaleString()}`,
    '',
    `  providers: ${config.providers.length > 0 ? '' : '(none configured)'}`
  );

  for (const p of config.providers) {
    lines.push(`    - ${p.id} (${p.type})`);
    if (p.model) {
      lines.push(`      model: ${p.model}`);
    }
    if (p.secretRef) {
      lines.push(`      secretRef: ${p.secretRef}`);
    }
    if (p.secretId) {
      lines.push(`      secretId: ${p.secretId}`);
    }
  }

  if (config.ui) {
    lines.push('', '  ui:');
    if (config.ui.colorScheme) {
      lines.push(`    colorScheme: ${config.ui.colorScheme}`);
    }
    if (config.ui.reduceMotion !== undefined) {
      lines.push(`    reduceMotion: ${config.ui.reduceMotion}`);
    }
  }

  return lines;
}

// =============================================================================
// Handlers
// =============================================================================

export async function handleConfigCommand(argv: readonly string[], io: CliIO): Promise<number> {
  const stdout = io.stdout ?? console.log;

  const subcommand = argv[0];

  // agentsy config path — print config file paths
  if (subcommand === 'path') {
    stdout(`User config:  ${userConfigPath()}`);
    stdout('Project config: ./.agentsy/config.json');
    return 0;
  }

  // agentsy config --json — print merged config as JSON
  if (argv.includes('--json')) {
    const config = await loadConfig();
    stdout(JSON.stringify(config, null, 2));
    return 0;
  }

  // agentsy config — print formatted merged config
  const config = await loadConfig();
  for (const line of formatConfig(config)) {
    stdout(line);
  }
  return 0;
}

export async function handleSettingsCommand(_argv: readonly string[], io: CliIO): Promise<number> {
  const stdout = io.stdout ?? console.log;

  const userFile = userConfigPath();

  if (!existsSync(userFile)) {
    stdout('No user config found. Creating default config...');
    const defaultConfig: Config = {
      version: 1,
      providers: [],
      budget: { inputCap: 128_000, outputCap: 16_384 },
      approvalPolicy: 'deny-destructive'
    };
    await writeFile(userFile, `${JSON.stringify(defaultConfig, null, 2)}\n`, 'utf-8');
    stdout(`Created: ${userFile}`);
    stdout('');
    stdout('Edit this file to configure providers, models, and preferences.');
    stdout('Run `agentsy doctor` to validate the configuration.');
    return 0;
  }

  stdout(`Settings file: ${userFile}`);
  stdout('');
  stdout('To edit settings, modify the JSON file above and run:');
  stdout('  agentsy doctor    # Validate configuration');
  stdout('  agentsy config    # View merged configuration');
  return 0;
}
