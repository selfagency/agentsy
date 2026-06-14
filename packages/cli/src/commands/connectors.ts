/**
 * Connectors CLI commands — manage platform connectors.
 *
 * ## Usage
 *
 * ```bash
 * agentsy connectors list           # List configured connectors
 * agentsy connectors check          # Health-check all connectors
 * ```
 */

import type { CliIO } from '../index.js';

// =============================================================================
// Handlers
// =============================================================================

export async function handleConnectorsListCommand(_argv: readonly string[], io: CliIO): Promise<number> {
  const stdout = io.stdout ?? console.log;

  stdout('Available connectors:');
  stdout('');

  const { isDiscordAdapterAvailable } = await import('@agentsy/connectors');
  const { isSlackAdapterAvailable } = await import('@agentsy/connectors');
  const { isTelegramAdapterAvailable } = await import('@agentsy/connectors');

  stdout(`  Discord:   ${isDiscordAdapterAvailable() ? '✅ available' : '❌ not available (install discord.js)'}`);
  stdout(`  Slack:     ${isSlackAdapterAvailable() ? '✅ available' : '❌ not available (install @slack/bolt)'}`);
  stdout(`  Telegram:  ${isTelegramAdapterAvailable() ? '✅ available' : '❌ not available (install grammy)'}`);

  return 0;
}

export async function handleConnectorsCheckCommand(_argv: readonly string[], io: CliIO): Promise<number> {
  const stdout = io.stdout ?? console.log;

  stdout('Checking connector availability...');
  stdout('');

  const { getConnectorSetupGuide, runConnectorDiagnostics } = await import('@agentsy/connectors');

  const report = runConnectorDiagnostics();
  let statusLabel: string;
  if (report.status === 'pass') {
    statusLabel = 'pass';
  } else if (report.status === 'warn') {
    statusLabel = 'warn';
  } else {
    statusLabel = 'fail';
  }
  stdout(`  Status: ${statusLabel}`);
  stdout(`  Summary: ${report.summary}`);
  stdout('');

  const guide = getConnectorSetupGuide();
  stdout('Setup guide:');
  for (const step of guide.steps) {
    stdout(`  - ${step}`);
  }

  return report.status === 'fail' ? 1 : 0;
}

// =============================================================================
// Router
// =============================================================================

export async function runConnectorsCommand(argv: readonly string[], io: CliIO): Promise<number> {
  const subcommand = argv[0];
  const rest = argv.slice(1);

  switch (subcommand) {
    case 'list': {
      return await handleConnectorsListCommand(rest, io);
    }
    case 'check': {
      return await handleConnectorsCheckCommand(rest, io);
    }
    default: {
      const stderr = io.stderr ?? console.error;
      stderr(`Unknown connectors subcommand: ${subcommand ?? '(none)'}`);
      stderr('Supported: list, check');
      return 1;
    }
  }
}
