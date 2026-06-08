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

import { createInterface, type Interface } from 'node:readline/promises';
import { loadSlashCommands } from '@agentsy/core';
import type { LoadBalancedClient, StrategyName } from '@agentsy/gateway';
import { StrategyNameSchema } from '@agentsy/gateway';
import { discoverLocalProviders, selectModel } from '@agentsy/models';
import { AgentRegistry } from '@agentsy/plugins';
import { SkillDiscoverer } from '@agentsy/plugins/skills';
import type { PlanAgentDefinition } from '@agentsy/runtime';
import { createAgentSession } from '@agentsy/runtime';
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

import { getFlagValue, hasFlag } from '../cli-args.js';

function getSelectionCriteria(argv: readonly string[]) {
  const local = hasFlag(argv, '--local');
  const capabilities = hasFlag(argv, '--tools') ? ['tool-use'] : [];

  return {
    ...(local ? { local: true } : {}),
    ...(capabilities.length > 0 ? { capabilities } : {})
  };
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

// ── Agent helpers ───────────────────────────────────────────────────────────────

function formatAgentDescription(agent: {
  id: string;
  name: string;
  description: string;
  allowedTools?: readonly string[] | '*';
  orchestrationMode?: string;
  defaultModel?: string;
}): string {
  const lines: string[] = [];
  lines.push(`  ${agent.name} (${agent.id})`);
  lines.push(`    description: ${agent.description}`);
  if (agent.orchestrationMode) {
    lines.push(`    mode: ${agent.orchestrationMode}`);
  }
  if (agent.defaultModel) {
    lines.push(`    default model: ${agent.defaultModel}`);
  }
  if (agent.allowedTools) {
    const toolCount = agent.allowedTools === '*' ? 'all' : String(agent.allowedTools.length);
    lines.push(`    tools: ${toolCount}`);
  }
  return lines.join('\n');
}

function formatSkillDescription(skill: {
  name: string;
  description: string;
  version?: string;
  author?: string;
}): string {
  const lines: string[] = [];
  lines.push(`  ${skill.name}`);
  lines.push(`    description: ${skill.description}`);
  if (skill.version) {
    lines.push(`    version: ${skill.version}`);
  }
  if (skill.author) {
    lines.push(`    author: ${skill.author}`);
  }
  return lines.join('\n');
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
  /** Pre-selected agent ID (from --agent flag or test seam). */
  agentId?: string | undefined;
  /** Headers printed before each assistant response block. */
  headers?: ChatHeaders | undefined;
  /**
   * Input stream override (for testing). Defaults to process.stdin.
   * Allows tests to provide a mock stream without mocking process.stdin.
   */
  input?: NodeJS.ReadableStream | undefined;
  /**
   * Test seam: a pre-built `LoadBalancedClient` to use as the
   * chat client. When set, the argv/provider config is ignored
   * and the supplied client is used directly. Used by the
   * `/lb` and `/model` slash-command tests.
   */
  loadBalancedClient?: LoadBalancedClient | undefined;
  /** Delay between mock chunks in ms (for testing). Set to 0 for fastest test. */
  mockChunkDelayMs?: number | undefined;
  /** Custom mock client response text (for testing). */
  mockResponseText?: string | undefined;
  /** When true, run in plan mode (no tool execution). */
  planMode?: boolean | undefined;
  /** Custom provider configuration (for testing / programmatic use). */
  providerConfig?: CliProviderConfig | undefined;
}

const DEFAULT_HEADERS: ChatHeaders = {
  prefix: `${dim('\u2500')} ${green('assistant')} ${dim('\u2500')}`
};

function createProviderClient(
  isMock: boolean,
  argv: readonly string[],
  options?: ChatCommandOptions
): LoadBalancedClient | ReturnType<typeof createMockClient> {
  if (isMock) {
    return createMockClient({
      responseText: options?.mockResponseText,
      chunkDelayMs: options?.mockChunkDelayMs
    });
  }

  // Test seam: an explicit pre-built `LoadBalancedClient` overrides
  // the argv-driven provider config. Used by the slash-command
  // tests to drive a stub client into the chat REPL.
  if (options?.loadBalancedClient !== undefined) {
    return options.loadBalancedClient;
  }

  const model = getFlagValue(argv, '--model') ?? 'gpt-4o-mini';
  const baseUrl = getFlagValue(argv, '--base-url') ?? undefined;
  const apiKey = getFlagValue(argv, '--api-key') ?? undefined;
  const providerId = getFlagValue(argv, '--provider') ?? 'openai';
  const selection = selectModel(getSelectionCriteria(argv));

  const providerEntry: CliProviderConfig['providers'][number] = {
    id: 'default',
    name: 'Default provider',
    provider: (selection.providerId ?? providerId) as CliProviderConfig['providers'][number]['provider']
  };
  if (baseUrl !== undefined) {
    providerEntry.baseUrl = baseUrl;
  }
  if (apiKey !== undefined) {
    providerEntry.apiKey = apiKey;
  }

  const providerConfig: CliProviderConfig = options?.providerConfig ?? {
    model: selection.modelId ?? model,
    providers: [providerEntry]
  };

  return resolveProviderClient(providerConfig);
}

/**
 * Execute the chat command.
 */
/**
 * Safely call rl.prompt() — Node 24 throws "readline was closed" after
 * input stream ends if test code uses setImmediate deferral combined
 * with stream.end(). Catch and ignore the error.
 */
function safePrompt(rl: Interface): void {
  try {
    rl.prompt();
  } catch {
    // readline was closed — safe to ignore in test/end-of-stream scenarios
  }
}

// fallow-ignore-next-line complexity
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: interactive REPL dispatch is inherently conditional
export async function runChatCommand(
  argv: readonly string[],
  io: CliIO,
  options?: ChatCommandOptions
): Promise<number> {
  const stderr = io.stderr ?? ((msg: string) => console.error(msg));
  const isMock = hasFlag(argv, '--mock');
  const model = getFlagValue(argv, '--model') ?? 'gpt-4o-mini';
  const headers = options?.headers ?? DEFAULT_HEADERS;

  // Parse --agent and --plan flags
  const selectedAgentId = getFlagValue(argv, '--agent') ?? options?.agentId ?? null;
  const planMode = hasFlag(argv, '--plan') || options?.planMode === true;

  // Resolve agent definition if an agent ID was provided
  let systemPrompt = 'You are a helpful assistant.';
  const registry = selectedAgentId === null ? null : new AgentRegistry();

  if (registry !== null && selectedAgentId !== null) {
    try {
      const agentDef = await registry.get(selectedAgentId);
      systemPrompt = agentDef.systemPromptTemplate ?? systemPrompt;
      stderr(dim(`[agent] loaded: ${agentDef.name} (${agentDef.id})\n`));
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      stderr(dim(`[agent] failed to load "${selectedAgentId}": ${msg}\n`));
    }
  }

  // Create plan session if in plan mode
  const planSession =
    planMode && selectedAgentId !== null
      ? await createAgentSession(
          {
            id: selectedAgentId,
            name: selectedAgentId,
            description: ''
          } satisfies PlanAgentDefinition,
          { agentId: selectedAgentId, plan: true }
        )
      : null;

  if (planMode) {
    stderr(dim('[plan] plan mode enabled — tools will not be executed\n'));
  }

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
    systemPrompt
  });

  const rl = createInterface({
    input: options?.input ?? process.stdin,
    output: process.stdout,
    prompt: `${cyan('> ')}`
  });

  safePrompt(rl);

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
    const cmdList = [...commands.keys()].sort((a, b) => a.localeCompare(b)).join(', ');
    const slashList = loadSlashCommands()
      .map(command => `${command.name}    ${command.description}`)
      .join('\n  ');
    stderr(`Commands:\n  ${cmdList}\n  ${slashList}\n  /help            Show this help message\n`);
  }

  function handleModelSearch(rest: string[]): void {
    stderr(dim(`[model] search query=${rest.join(' ')}\n`));
  }

  function handleModelSelect(rest: string[]): void {
    const newModel = rest[0];
    if (newModel === undefined || newModel.length === 0) {
      stderr(dim('[model] usage: /model select <alias-or-upstream-id>\n'));
      return;
    }
    if (!isGatewayClient(client)) {
      stderr(dim('[model] cannot switch: client is not a load-balanced gateway client\n'));
      return;
    }
    try {
      const switcher = client.createModelSwitcher();
      const result = switcher.switch({ model: newModel });
      stderr(dim(`[model] switched to ${result.model} on ${result.provider}\n`));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      stderr(dim(`[model] switch failed: ${message}\n`));
    }
  }

  function handleModelList(): void {
    if (!isGatewayClient(client)) {
      stderr(dim('[model] cannot list: client is not a load-balanced gateway client\n'));
      return;
    }
    const models = client.createModelSwitcher().getSupportedModels();
    if (models.length === 0) {
      stderr(dim('[model] no models available\n'));
      return;
    }
    const lines = models.map(m => {
      const aliasPart = m.alias.length > 0 ? ` (alias: ${m.alias})` : '';
      return `  ${m.provider}/${m.upstreamModel}${aliasPart}`;
    });
    stderr(dim(`[model] available models:\n${lines.join('\n')}\n`));
  }

  function handleModelCommand(args: string[]): void {
    const [action, ...rest] = args;
    if (action === 'search') {
      handleModelSearch(rest);
      return;
    }
    if (action === 'select') {
      handleModelSelect(rest);
      return;
    }
    if (action === 'refine') {
      stderr(dim('[model] refine selection criteria\n'));
      return;
    }
    if (action === 'list') {
      handleModelList();
      return;
    }
    if (action) {
      stderr(dim(`[model] unknown action: ${action}\n`));
    } else {
      stderr(dim(`[model] current model: ${model}\n`));
    }
  }

  function isGatewayClient(c: typeof client): c is LoadBalancedClient {
    return (
      typeof (c as LoadBalancedClient).createModelSwitcher === 'function' &&
      typeof (c as LoadBalancedClient).getRoutingState === 'function' &&
      typeof (c as LoadBalancedClient).getMetricsSnapshot === 'function'
    );
  }

  function handleLbStatusCommand(): void {
    if (!isGatewayClient(client)) {
      stderr(dim('[lb] cannot show status: client is not a load-balanced gateway client\n'));
      return;
    }
    const state = client.getRoutingState();
    const usage = client.getUsageSnapshot();
    const metrics = client.getMetricsSnapshot();
    const lines: string[] = [];
    lines.push(
      `[lb] strategy=${state.strategy} provider=${state.providerId} status=${state.providerStatus} providers=${state.providerCount}`
    );
    for (const u of usage) {
      const parts: string[] = [`  ${u.providerId}`];
      if (u.errorRate !== undefined) {
        parts.push(`err=${(u.errorRate * 100).toFixed(1)}%`);
      }
      if (u.averageLatencyMs !== undefined) {
        parts.push(`lat=${Math.round(u.averageLatencyMs)}ms`);
      }
      if (u.rpmRemaining !== undefined) {
        parts.push(`rpm=${u.rpmRemaining}`);
      }
      if (u.tpmRemaining !== undefined) {
        parts.push(`tpm=${u.tpmRemaining}`);
      }
      lines.push(parts.join(' '));
    }
    lines.push(
      `[lb] metrics: requests=${metrics.requestCount} success=${metrics.successCount} failure=${metrics.failureCount} failovers=${metrics.failoverCount} circuitTrips=${metrics.circuitTrips}`
    );
    lines.push(
      `[lb] totals: tokens=${metrics.totalTokens} (in=${metrics.totalInputTokens} out=${metrics.totalOutputTokens}) cost=$${metrics.totalCostUsd.toFixed(4)}`
    );
    if (metrics.streamCount > 0) {
      lines.push(
        `[lb] streams: count=${metrics.streamCount} success=${metrics.streamSuccessCount} failure=${metrics.streamFailureCount} chunks=${metrics.totalStreamChunks} duration=${metrics.totalStreamDurationMs}ms ttfb=${metrics.totalStreamTtfbMs}ms`
      );
    }
    stderr(dim(`${lines.join('\n')}\n`));
  }

  function handleLbProvidersCommand(): void {
    if (!isGatewayClient(client)) {
      stderr(dim('[lb] cannot list providers: client is not a load-balanced gateway client\n'));
      return;
    }
    const usage = client.getUsageSnapshot();
    const lines: string[] = ['[lb] providers:'];
    for (const u of usage) {
      lines.push(`  ${u.providerId}`);
    }
    if (lines.length === 1) {
      lines.push('  (no providers)');
    }
    stderr(dim(`${lines.join('\n')}\n`));
  }

  function handleLbStrategyCommand(args: string[]): void {
    if (!isGatewayClient(client)) {
      stderr(dim('[lb] cannot switch strategy: client is not a load-balanced gateway client\n'));
      return;
    }
    const name = args[0];
    if (name === undefined || name.length === 0) {
      const state = client.getRoutingState();
      stderr(dim(`[lb] current strategy: ${state.strategy}\n`));
      stderr(dim('[lb] usage: /lb strategy <name>\n'));
      return;
    }
    const parsed = StrategyNameSchema.safeParse(name);
    if (!parsed.success) {
      stderr(
        dim(`[lb] unknown strategy: ${name} (valid: ${StrategyNameSchema.options.map(o => o.toString()).join(', ')})\n`)
      );
      return;
    }
    client.setStrategy(parsed.data as StrategyName);
    stderr(dim(`[lb] strategy switched to: ${parsed.data}\n`));
  }

  function handleLbResetCommand(args: string[]): void {
    if (!isGatewayClient(client)) {
      stderr(dim('[lb] cannot reset: client is not a load-balanced gateway client\n'));
      return;
    }
    const providerId = args[0];
    if (providerId === undefined || providerId.length === 0) {
      stderr(dim('[lb] usage: /lb reset <providerId>\n'));
      return;
    }
    client.markProviderHealthy(providerId);
    stderr(dim(`[lb] reset circuit for: ${providerId}\n`));
  }

  async function handleProviderCommand(_args: string[]): Promise<void> {
    stderr(dim('[provider] discovering local providers...\n'));
    const result = await listProviders();
    stderr(dim(`${result}\n`));
  }

  function handleStatusCommand(): void {
    stderr(dim(`[status] model: ${model}\n`));
  }

  // ── /agent command handlers ───────────────────────────────────────────────────────

  async function handleAgentList(): Promise<void> {
    const reg = registry ?? new AgentRegistry();
    try {
      const agents = await reg.list();
      if (agents.length === 0) {
        stderr(dim('[agent] no agents found\n'));
        return;
      }
      const descriptions = agents.map(formatAgentDescription);
      stderr(dim(`[agent] ${agents.length} agent(s) available:\n${descriptions.join('\n')}\n`));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      stderr(dim(`[agent] list failed: ${message}\n`));
    }
  }

  async function handleAgentShow(agentId: string): Promise<void> {
    const reg = registry ?? new AgentRegistry();
    try {
      const agent = await reg.get(agentId);
      stderr(dim(`[agent] ${agentId}:\n${formatAgentDescription(agent)}\n`));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      stderr(dim(`[agent] "${agentId}" not found: ${message}\n`));
    }
  }

  function handleAgentSelect(agentId: string): void {
    stderr(dim(`[agent] switch intent logged: ${agentId}\n`));
    stderr(dim('[agent] note: full agent switching is not yet implemented\n'));
  }

  async function handleAgentDispatch(args: string[]): Promise<void> {
    const [action, ...rest] = args;
    if (action === 'list') {
      await handleAgentList();
    } else if (action === 'show') {
      const agentId = rest[0] ?? '';
      if (agentId.length === 0) {
        stderr(dim('[agent] usage: /agent show <agentId>\n'));
        return;
      }
      await handleAgentShow(agentId);
    } else if (action === 'select') {
      const agentId = rest[0] ?? '';
      if (agentId.length === 0) {
        stderr(dim('[agent] usage: /agent select <agentId>\n'));
        return;
      }
      handleAgentSelect(agentId);
    } else if (action === undefined) {
      stderr(dim('[agent] usage: /agent list | show <agentId> | select <agentId>\n'));
    } else {
      stderr(dim(`[agent] unknown action: ${action}\n`));
    }
  }

  // ── /skills command handlers ──────────────────────────────────────────────────────

  async function handleSkillsList(): Promise<void> {
    const discoverer = new SkillDiscoverer();
    try {
      const skills = await discoverer.discover();
      if (skills.length === 0) {
        stderr(dim('[skills] no skills found\n'));
        return;
      }
      const descriptions = skills.map(formatSkillDescription);
      stderr(dim(`[skills] ${skills.length} skill(s) available:\n${descriptions.join('\n')}\n`));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      stderr(dim(`[skills] list failed: ${message}\n`));
    }
  }

  async function handleSkillsShow(skillName: string): Promise<void> {
    const discoverer = new SkillDiscoverer();
    try {
      const skills = await discoverer.discover();
      const match = skills.find((s: { name: string }) => s.name.toLowerCase() === skillName.toLowerCase());
      if (match === undefined) {
        stderr(dim(`[skills] "${skillName}" not found\n`));
        return;
      }
      stderr(dim(`[skills] ${skillName}:\n${formatSkillDescription(match)}\n`));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      stderr(dim(`[skills] show failed: ${message}\n`));
    }
  }

  async function handleSkillsDispatch(args: string[]): Promise<void> {
    const [action, ...rest] = args;
    if (action === 'list') {
      await handleSkillsList();
    } else if (action === 'show') {
      const skillName = rest[0] ?? '';
      if (skillName.length === 0) {
        stderr(dim('[skills] usage: /skills show <skillName>\n'));
        return;
      }
      await handleSkillsShow(skillName);
    } else if (action === undefined) {
      stderr(dim('[skills] usage: /skills list | show <skillName>\n'));
    } else {
      stderr(dim(`[skills] unknown action: ${action}\n`));
    }
  }

  // NOSONAR -- Intentional no-op: unknown commands are silently ignored
  function handleUnknownCommand(_command: string): void {
    /* intentional no-op */
  }

  function handleLbDispatch(trimmed: string): void {
    const args = trimmed.slice(4).trim().split(/\s+/u);
    const sub = args[0];
    if (sub === 'status' || sub === undefined) {
      handleLbStatusCommand();
    } else if (sub === 'providers') {
      handleLbProvidersCommand();
    } else if (sub === 'strategy') {
      handleLbStrategyCommand(args.slice(1));
    } else if (sub === 'reset') {
      handleLbResetCommand(args.slice(1));
    } else {
      stderr(dim(`[lb] unknown subcommand: ${sub}\n`));
      stderr(dim('[lb] usage: /lb status | providers | strategy <name> | reset <providerId>\n'));
    }
  }

  /**
   * Dispatch a single trimmed input line — returns true when the caller should exit.
   */
  async function dispatchLine(trimmed: string): Promise<boolean> {
    if (trimmed === '') {
      safePrompt(rl);
      return false;
    }

    // Slash commands with arguments (startsWith) are dispatched
    // before the exact-map lookup so the suffix can be parsed.
    if (trimmed.startsWith('/model ')) {
      handleModelCommand(trimmed.slice(7).trim().split(/\s+/u));
      safePrompt(rl);
      return false;
    }

    if (trimmed.startsWith('/provider ')) {
      await handleProviderCommand(trimmed.slice(10).trim().split(/\s+/u));
      safePrompt(rl);
      return false;
    }

    if (trimmed.startsWith('/agent ')) {
      await handleAgentDispatch(trimmed.slice(7).trim().split(/\s+/u));
      safePrompt(rl);
      return false;
    }

    if (trimmed.startsWith('/skills ')) {
      await handleSkillsDispatch(trimmed.slice(8).trim().split(/\s+/u));
      safePrompt(rl);
      return false;
    }

    if (trimmed.startsWith('/lb ')) {
      handleLbDispatch(trimmed);
      safePrompt(rl);
      return false;
    }

    const handler = commandHandlers.get(trimmed);
    if (handler !== undefined) {
      await handler([]);
      if (shouldExit) {
        return true;
      }
      safePrompt(rl);
      return false;
    }

    if (trimmed.startsWith('/')) {
      handleUnknownCommand(trimmed);
      safePrompt(rl);
      return false;
    }

    await processUserMessage(trimmed);
    safePrompt(rl);
    return false;
  }

  async function processUserMessage(message: string): Promise<void> {
    // Plan mode — generate structured plan instead of executing tools
    if (planSession !== null) {
      try {
        const result = await planSession.step(message);
        process.stdout.write(`${result.text}\n`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        stderr(`\n${dim('[plan] error:')} ${msg}\n`);
      }
      return;
    }

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
    ['/status', () => handleStatusCommand()],
    ['/model', () => handleModelCommand([])],
    ['/agent', () => handleAgentDispatch([])],
    ['/skills', () => handleSkillsDispatch([])],
    ['/lb', () => handleLbStatusCommand()],
    ['/lb status', () => handleLbStatusCommand()],
    ['/lb providers', () => handleLbProvidersCommand()],
    ['/lb strategy', () => handleLbStrategyCommand([])],
    ['/lb reset', () => handleLbResetCommand([])]
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
