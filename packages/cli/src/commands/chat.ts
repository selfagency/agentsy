/**
 * Interactive chat command for the @agentsy CLI.
 *
 * Provides a readline-based interactive REPL that sends messages to an LLM
 * provider and streams responses token by token to stdout. Supports both
 * real provider connections (via load-balanced client) and a mock provider
 * for testing and dogfooding without live API keys.
 *
 * @example
 * ```bash
 * # Chat with a mock provider (no API key needed)
 * npx agentsy chat --mock
 *
 * # Chat with OpenAI
 * npx agentsy chat --model gpt-4
 * ```
 */

import { createInterface } from 'node:readline/promises';

import { discoverLocalProviders } from '@agentsy/models';
import type { TurnHandler } from '@agentsy/runtime/loop';
import { createSimpleTurnLoop } from '@agentsy/runtime/loop';

import type { CliIO } from '../index.js';
import { createMockClient } from '../providers/mock.js';
import type { CliProviderConfig } from '../providers/resolve-provider.js';
import { resolveProviderClient } from '../providers/resolve-provider.js';

// ── ANSI helpers ────────────────────────────────────────────────────────────────

const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

function dim(text: string): string {
  return `${DIM}${text}${RESET}`;
}

function green(text: string): string {
  return `${GREEN}${text}${RESET}`;
}

function cyan(text: string): string {
  return `${CYAN}${text}${RESET}`;
}

function yellow(text: string): string {
  return `${YELLOW}${text}${RESET}`;
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

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

function formatUsage(inputTokens: number | undefined, outputTokens: number | undefined): string {
  const parts: string[] = [];
  if (inputTokens !== undefined) {
    parts.push(`\u2191${inputTokens}`);
  }
  if (outputTokens !== undefined) {
    parts.push(`\u2193${outputTokens}`);
  }
  return parts.length > 0 ? parts.join(' ') : '';
}

// ── Provider listing ────────────────────────────────────────────────────────────

async function listProviders(): Promise<string> {
  try {
    const discovery = await discoverLocalProviders();
    if (discovery.discovered.length > 0) {
      const lines: string[] = [];
      lines.push(`[provider] found ${discovery.discovered.length} local provider(s):`);
      for (const { provider, models } of discovery.discovered) {
        lines.push(`  ${provider}: ${models.length} model(s)`);
        for (const m of models.slice(0, 3)) {
          lines.push(`    - ${m.id}`);
        }
        if (models.length > 3) {
          lines.push(`    ... and ${models.length - 3} more`);
        }
      }
      return lines.join('\n');
    }
    return '[provider] no local providers found';
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `[provider] error: ${message}`;
  }
}

// ── Chat command ────────────────────────────────────────────────────────────────

export interface ChatHeaders {
  /** ANSI-styled header line shown before the assistant response. */
  prefix: string;
}

/**
 * Options for fine-tuning chat command behaviour.
 */
export interface ChatCommandOptions {
  /** Headers printed before each assistant response block. */
  headers?: ChatHeaders | undefined;
  /** Delay between mock chunks in ms (for testing). Set to 0 for fastest test. */
  mockChunkDelayMs?: number | undefined;
  /** Custom mock client response text (for testing). */
  mockResponseText?: string | undefined;
  /** Custom provider configuration (for testing / programmatic use). */
  providerConfig?: CliProviderConfig | undefined;
}

const DEFAULT_HEADERS: ChatHeaders = {
  prefix: `${dim('\u2500')} ${green('assistant')} ${dim('\u2500')}`
};

function createProviderClient(isMock: boolean, argv: readonly string[], options?: ChatCommandOptions) {
  if (isMock) {
    return createMockClient({
      responseText: options?.mockResponseText,
      chunkDelayMs: options?.mockChunkDelayMs
    });
  }

  const model = getFlagValue(argv, '--model') ?? 'gpt-4o-mini';
  const baseUrl = getFlagValue(argv, '--base-url') ?? undefined;
  const apiKey = getFlagValue(argv, '--api-key') ?? undefined;

  const providerEntry: CliProviderConfig['providers'][number] = {
    id: 'default',
    name: 'Default provider',
    provider: (getFlagValue(argv, '--provider') as CliProviderConfig['providers'][number]['provider']) ?? 'openai'
  };
  if (baseUrl !== undefined) {
    providerEntry.baseUrl = baseUrl;
  }
  if (apiKey !== undefined) {
    providerEntry.apiKey = apiKey;
  }

  const providerConfig: CliProviderConfig = options?.providerConfig ?? {
    model,
    providers: [providerEntry]
  };

  return resolveProviderClient(providerConfig);
}

/**
 * Execute the chat command.
 */
export async function runChatCommand(
  argv: readonly string[],
  io: CliIO,
  options?: ChatCommandOptions
): Promise<number> {
  const stderr = io.stderr ?? ((msg: string) => console.error(msg));
  const isMock = hasFlag(argv, '--mock');
  const model = getFlagValue(argv, '--model') ?? 'gpt-4o-mini';
  const headers = options?.headers ?? DEFAULT_HEADERS;

  const client = createProviderClient(isMock, argv, options);

  if (isMock) {
    stderr(dim(`[mock] model=${model}\n`));
  } else {
    stderr(dim(`model=${model}\n`));
  }

  const handler: TurnHandler = { stream: req => client.stream(req) };
  const loop = createSimpleTurnLoop({
    handler,
    model,
    systemPrompt: 'You are a helpful assistant.'
  });

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${cyan('> ')}`
  });

  rl.prompt();

  // ── Command handlers ──────────────────────────────────────────────────────────────

  let shouldExit = false;

  function handleExitCommand(): void {
    shouldExit = true;
  }

  function handleClearCommand(): void {
    console.clear();
    loop.reset();
  }

  function handleHelpCommand(commands: Map<string, (args: string[]) => void | Promise<void>>): void {
    const cmdList = [...commands.keys()].sort().join(', ');
    stderr(
      `Commands:\n  ${cmdList}\n  /model <name>    Switch to a different model\n  /help            Show this help message\n`
    );
  }

  function handleModelCommand(args: string[]): void {
    const newModel = args[0];
    if (newModel) {
      stderr(dim(`[model] model switching requires restart (current: ${model}, requested: ${newModel})\n`));
    } else {
      stderr(dim(`[model] current model: ${model}\n`));
    }
  }

  async function handleProviderCommand(_args: string[]): Promise<void> {
    stderr(dim('[provider] discovering local providers...\n'));
    const result = await listProviders();
    stderr(dim(`${result}\n`));
  }

  function handleStatusCommand(): void {
    stderr(dim(`[status] model: ${model}\n`));
  }

  function handleUnknownCommand(_command: string): void {
    // Unknown command — just re-prompt
  }

  /**
   * Dispatch a single trimmed input line — returns true when the caller should exit.
   */
  async function dispatchLine(trimmed: string): Promise<boolean> {
    // Empty input
    if (trimmed === '') {
      rl.prompt();
      return false;
    }

    // /model uses startsWith — handle before exact map lookup
    if (trimmed.startsWith('/model ')) {
      handleModelCommand([trimmed.slice(7).trim()]);
      rl.prompt();
      return false;
    }

    // Look up exact command in handler map
    const handler = commandHandlers.get(trimmed);
    if (handler !== undefined) {
      await handler([]);
      if (shouldExit) {
        return true;
      }
      rl.prompt();
      return false;
    }

    // Unknown slash command
    if (trimmed.startsWith('/')) {
      handleUnknownCommand(trimmed);
      rl.prompt();
      return false;
    }

    // Send to LLM
    await processUserMessage(trimmed);
    rl.prompt();
    return false;
  }

  async function processUserMessage(message: string): Promise<void> {
    process.stdout.write(`${headers.prefix}\n`);

    try {
      await loop.run(message, {
        onText: delta => {
          process.stdout.write(delta);
        },
        onThinking: delta => {
          process.stdout.write(dim(delta));
        },
        onDone: (_finishReason, usage) => {
          const usageStr = formatUsage(usage?.inputTokens, usage?.outputTokens);
          if (usageStr) {
            process.stdout.write(`\n${dim('\u2500\u2500\u2500')} ${yellow(usageStr)} ${dim('\u2500\u2500\u2500')}\n`);
          }
        },
        onError: error => {
          stderr(`\n${dim('[error]')} ${error.message}\n`);
        }
      });
      process.stdout.write('\n');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      stderr(`\n${dim('[error]')} ${message}\n`);
    }
  }

  const commandHandlers = new Map<string, (args: string[]) => void | Promise<void>>([
    ['/exit', () => handleExitCommand()],
    ['/quit', () => handleExitCommand()],
    ['/clear', () => handleClearCommand()],
    ['/provider', args => handleProviderCommand(args)],
    ['/status', () => handleStatusCommand()]
  ]);

  // Help handler needs the map reference, so set it after creation
  commandHandlers.set('/help', () => handleHelpCommand(commandHandlers));

  // ── Main loop ─────────────────────────────────────────────────────────────────────

  try {
    for await (const line of rl) {
      const shouldBreak = await dispatchLine(line.trim());
      if (shouldBreak) {
        break;
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    stderr(`${dim('[error]')} ${message}\n`);
    return 1;
  } finally {
    rl.close();
  }

  return 0;
}
