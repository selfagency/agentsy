/**
 * Ink TUI command — full Agentsy IDE experience.
 *
 * Launched as the default entry-point when `agentsy` is invoked with no
 * subcommand, or explicitly via `agentsy tui`.  Wires the turn loop,
 * CLI stream bridge, and Ink agent renderer into a single interactive
 * terminal session.
 *
 * @example
 * ```bash
 * # Launch the TUI (default)
 * agentsy
 *
 * # Explicit subcommand
 * agentsy tui --model claude-3-5-sonnet
 *
 * # Use a mock provider (no API key)
 * agentsy tui --mock
 * ```
 */

import { createCliStreamBridge } from '@agentsy/renderers/adapters';
import { createInkAgentRenderer, createInkRuntimeController } from '@agentsy/renderers/ink';
import type { TurnHandler } from '@agentsy/runtime/loop';
import { createSimpleTurnLoop } from '@agentsy/runtime/loop';

import type { CliIO } from '../index.js';
import { createMockClient } from '../providers/mock.js';
import type { CliProviderConfig } from '../providers/resolve-provider.js';
import { resolveProviderClient } from '../providers/resolve-provider.js';

// ── Helpers (mirrored from chat.ts until a shared utils module is added) ────────

function hasFlag(args: readonly string[], flag: string): boolean {
  return args.includes(flag);
}

function getFlagValue(args: readonly string[], flag: string): string | null {
  const index = args.indexOf(flag);
  if (index === -1) {
    return null;
  }
  return args.at(index + 1) ?? null;
}

function createProviderClient(isMock: boolean, argv: readonly string[]) {
  if (isMock) {
    return createMockClient({});
  }

  const model = getFlagValue(argv, '--model') ?? 'gpt-4o-mini';
  const providerConfig: CliProviderConfig = {
    model,
    providers: [
      {
        id: 'default',
        name: 'Default provider',
        provider: (getFlagValue(argv, '--provider') as CliProviderConfig['providers'][number]['provider']) ?? 'openai'
      }
    ]
  };

  return resolveProviderClient(providerConfig);
}

// ── TUI command ──────────────────────────────────────────────────────────────────

/**
 * Run the full Ink TUI agent session.
 */
export async function runTuiCommand(argv: readonly string[], _io: CliIO): Promise<number> {
  const isMock = hasFlag(argv, '--mock');
  const model = getFlagValue(argv, '--model') ?? 'gpt-4o-mini';

  const client = createProviderClient(isMock, argv);
  const handler: TurnHandler = { stream: req => client.stream(req) };
  const loop = createSimpleTurnLoop({ handler, model });

  const controller = createInkRuntimeController({
    onWarning: () => {
      /* noop */
    }
  });
  const bridgeEvents = createCliStreamBridge(controller.listeners);

  const handle = await createInkAgentRenderer({
    controller,
    onInput: async (text: string) => {
      await loop.run(text, bridgeEvents);
    }
  });

  await handle.waitUntilExit();

  return 0;
}
