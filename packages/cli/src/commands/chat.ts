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

import { ModelSelector, discoverLocalProviders } from '@agentsy/models';
import { filterProvidersByCapabilities, modelCapabilitiesToProviderRequirements } from '@agentsy/providers';
import { createSimpleTurnLoop } from '@agentsy/runtime/loop';
import type { TurnHandler } from '@agentsy/runtime/loop';

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
  return args[index + 1] ?? null;
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

// ── Chat command ────────────────────────────────────────────────────────────────

export interface ChatHeaders {
  /** ANSI-styled header line shown before the assistant response. */
  prefix: string;
}

/**
 * Options for fine-tuning chat command behaviour.
 */
export interface ChatCommandOptions {
  /** Custom provider configuration (for testing / programmatic use). */
  providerConfig?: CliProviderConfig | undefined;
  /** Custom mock client response text (for testing). */
  mockResponseText?: string | undefined;
  /** Delay between mock chunks in ms (for testing). Set to 0 for fastest test. */
  mockChunkDelayMs?: number | undefined;
  /** Headers printed before each assistant response block. */
  headers?: ChatHeaders | undefined;
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

  const providerConfig: CliProviderConfig = options?.providerConfig ?? {
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
  const loop = createSimpleTurnLoop({ handler, model, systemPrompt: 'You are a helpful assistant.' });

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${cyan('> ')}`
  });

  rl.prompt();

  try {
    for await (const line of rl) {
      const trimmed = line.trim();

      if (trimmed === '/exit' || trimmed === '/quit') {
        break;
      }

      if (trimmed === '/clear') {
        console.clear();
        loop.reset();
        rl.prompt();
        continue;
      }

      if (trimmed === '/help') {
        stderr(
          'Commands:\n' +
            '  /exit, /quit     Exit the chat\n' +
            '  /clear           Clear conversation history\n' +
            '  /model <name>    Switch to a different model\n' +
            '  /provider        List available providers\n' +
            '  /status          Show current model and provider\n' +
            '  /help            Show this help message\n'
        );
        rl.prompt();
        continue;
      }

      if (trimmed.startsWith('/model ')) {
        const newModel = trimmed.slice(7).trim();
        if (newModel) {
          stderr(dim(`[model] model switching requires restart (current: ${model}, requested: ${newModel})\n`));
        } else {
          stderr(dim(`[model] current model: ${model}\n`));
        }
        rl.prompt();
        continue;
      }

      if (trimmed === '/provider') {
        stderr(dim(`[provider] discovering local providers...\n`));
        try {
          const discovery = await discoverLocalProviders();
          if (discovery.discovered.length > 0) {
            stderr(dim(`[provider] found ${discovery.discovered.length} local provider(s):\n`));
            for (const { provider, models } of discovery.discovered) {
              stderr(dim(`  ${provider}: ${models.length} model(s)\n`));
              for (const m of models.slice(0, 3)) {
                stderr(dim(`    - ${m.id}\n`));
              }
              if (models.length > 3) {
                stderr(dim(`    ... and ${models.length - 3} more\n`));
              }
            }
          } else {
            stderr(dim(`[provider] no local providers found\n`));
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          stderr(dim(`[provider] error: ${message}\n`));
        }
        rl.prompt();
        continue;
      }

      if (trimmed === '/status') {
        stderr(dim(`[status] model: ${model}\n`));
        rl.prompt();
        continue;
      }

      if (trimmed === '' || trimmed.startsWith('/')) {
        rl.prompt();
        continue;
      }

      process.stdout.write(`${headers.prefix}\n`);

      try {
        await loop.run(trimmed, {
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

      rl.prompt();
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
