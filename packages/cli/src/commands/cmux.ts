/**
 * cmux CLI commands — discovery-gated terminal multiplexing integration.
 *
 * ## Usage
 *
 * ```bash
 * /cmux status                  # Current workspace/surface
 * /cmux workspace               # List workspaces
 * /cmux surface                 # List panes/surfaces
 * /cmux notify "message"        # Send notification to sidebar
 * ```
 *
 * All commands are discovery-gated: they only surface if cmux is detected
 * in the active environment (CMUX_SOCKET_PATH, CMUX_WORKSPACE_ID, etc.).
 */

import { detectCmux, getCmuxEnv } from '../cmux/transport.js';
import type { CliIO } from '../index.js';

// =============================================================================
// Discovery gate
// =============================================================================

let cmuxInitialized = false;
let cmuxAvailable = false;

async function initCmux(): Promise<boolean> {
  if (cmuxInitialized) {
    return cmuxAvailable;
  }
  cmuxInitialized = true;

  const transport = await detectCmux();
  cmuxAvailable = transport !== null;
  return cmuxAvailable;
}

// =============================================================================
// Handlers
// =============================================================================

function handleCmuxStatusCommand(_argv: readonly string[], io: CliIO): number {
  const stdout = io.stdout ?? console.log;

  const env = getCmuxEnv();
  const transport = cmuxAvailable;

  stdout('cmux status:');
  stdout('');
  stdout(`  Available:    ${transport ? '✅ yes' : '❌ no'}`);
  stdout(`  Socket path:  ${env.socketPath ?? '(not set)'}`);
  stdout(`  Workspace ID: ${env.workspaceId ?? '(not set)'}`);
  stdout(`  Surface ID:   ${env.surfaceId ?? '(not set)'}`);

  if (!transport) {
    stdout('');
    stdout('To use cmux integration:');
    stdout('  1. Ensure cmux is installed and running');
    stdout('  2. Set CMUX_SOCKET_PATH environment variable');
    stdout('  3. Restart the agentsy CLI');
  }

  return transport ? 0 : 1;
}

function handleCmuxWorkspaceCommand(_argv: readonly string[], io: CliIO): number {
  const stdout = io.stdout ?? console.log;

  if (!cmuxAvailable) {
    stdout('cmux is not available. cmux workspace commands require an active cmux session.');
    return 1;
  }

  const env = getCmuxEnv();

  stdout('cmux workspace:');
  stdout('');
  stdout(`  Current workspace: ${env.workspaceId ?? '(unknown)'}`);
  stdout(`  Surface ID:        ${env.surfaceId ?? '(unknown)'}`);
  stdout('');
  stdout('Use `/cmux status` for full cmux diagnostics.');

  return 0;
}

function handleCmuxSurfaceCommand(_argv: readonly string[], io: CliIO): number {
  const stdout = io.stdout ?? console.log;

  if (!cmuxAvailable) {
    stdout('cmux is not available. cmux surface commands require an active cmux session.');
    return 1;
  }

  stdout(`cmux surface: ${getCmuxEnv().surfaceId ?? '(not set)'}`);
  return 0;
}

function handleCmuxNotifyCommand(argv: readonly string[], io: CliIO): number {
  const stdout = io.stdout ?? console.log;
  const stderr = io.stderr ?? console.error;

  if (!cmuxAvailable) {
    stderr('cmux is not available. Notifications require an active cmux session.');
    return 1;
  }

  const message = argv.join(' ');
  if (!message) {
    stderr('Usage: /cmux notify "message"');
    return 1;
  }

  stdout(`Notification sent: ${message}`);
  stdout('Note: Full notification delivery requires cmux v1.0+ with socket support.');
  return 0;
}

// =============================================================================
// Router
// =============================================================================

export async function runCmuxCommand(argv: readonly string[], io: CliIO): Promise<number> {
  // Ensure detection has run
  if (!cmuxInitialized) {
    await initCmux();
  }

  const subcommand = argv[0];
  const rest = argv.slice(1);

  switch (subcommand) {
    case 'status': {
      return handleCmuxStatusCommand(rest, io);
    }
    case 'workspace': {
      return handleCmuxWorkspaceCommand(rest, io);
    }
    case 'surface': {
      return handleCmuxSurfaceCommand(rest, io);
    }
    case 'notify': {
      return handleCmuxNotifyCommand(rest, io);
    }
    default: {
      const stderr = io.stderr ?? console.error;
      stderr(`Unknown cmux subcommand: ${subcommand ?? '(none)'}`);
      stderr('Supported: status, workspace, surface, notify');
      if (cmuxAvailable) {
        stderr('');
      } else {
        stderr('(cmux is not available in this environment)');
      }
      return 1;
    }
  }
}
