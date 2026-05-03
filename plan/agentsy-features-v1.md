---
goal: '@agentsy platform — caveman, skills, MCP management, superpowers, slash commands, and chat connectors'
version: '1.0'
date_created: '2026-05-03'
last_updated: '2026-05-03'
owner: 'selfagency'
status: 'Planned'
tags: ['feature', 'caveman', 'skills', 'mcp', 'superpowers', 'slash-commands', 'connectors', 'agentsy']
---

# @agentsy Platform — Feature Extensions v1

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

Additive extension to `agentsy-platform-v2.md`. Introduces six new feature domains to the `@agentsy` monorepo:

1. **Caveman Mode** — token-compression skill + MCP proxy + subagent variants (`@agentsy/caveman`)
2. **Skills Management** — programmatic `npx skills` wrapper for discovery and installation (`@agentsy/skills`)
3. **MCP Server Management** — `@mcpmarket/mcp-auto-install` as a first-class bundled MCP meta-server (extension to `@agentsy/mcp`)
4. **Superpowers Framework** — auto-activating TDD/planning workflow methodology skills (`@agentsy/superpowers`)
5. **Slash Commands** — consumer-configurable SKILL.md command registry with a stock set (`@agentsy/slash-commands`)
6. **Chat Platform Connectors** — multi-channel gateway adapter inspired by OpenClaw/NanoClaw (`@agentsy/connectors`)

All changes are additive. Existing REQ/SEC/CON/ADR identifiers in `agentsy-platform-v2.md` and `agentsy-prd-notes.md` are preserved.

---

## 1. Requirements & Constraints

### New Functional Requirements (additive to REQ-001 through REQ-024)

- **REQ-025**: `@agentsy/caveman` must ship the `caveman` SKILL.md (JuliusBrussee/caveman v1.7.0) as a bundled default skill, activatable by consumer agents without a separate `npx skills add` step.
- **REQ-026**: `@agentsy/caveman` must include `caveman-shrink` — an MCP stdio proxy that wraps any downstream MCP server and compresses tool description tokens while preserving code literals, URLs, and identifiers byte-for-byte.
- **REQ-027**: `@agentsy/caveman` must expose `cavecrew` subagent variant SKILL.md files (investigator, builder, reviewer) that emit ~60% fewer output tokens than vanilla equivalents.
- **REQ-028**: Caveman mode intensity must be settable via `CavemanMode`: `'lite' | 'full' | 'ultra' | 'wenyan-lite' | 'wenyan-full' | 'wenyan-ultra'`. Default: `'full'`.
- **REQ-029**: `@agentsy/skills` must provide a `SkillsManager` factory with async methods: `find(query)`, `add(ref)`, `list()`, `remove(name)`, `update(name)`, `init(path)` — a Node.js wrapper around the `npx skills` CLI (vercel-labs/skills).
- **REQ-030**: `@agentsy/skills` must support searching the public skills registry at skills.sh by natural language query, returning ranked `SkillSearchResult[]` with name, description, author, and install command.
- **REQ-031**: `@agentsy/mcp` must bundle `@mcpmarket/mcp-auto-install v0.2.1` as a default MCP server in every `MCPOrchestrator` instance. The five `mai_*` tools (`mai_search`, `mai_details`, `mai_readme`, `mai_install`, `mai_remove`) must be exposed as first-class tools to the agent loop.
- **REQ-032**: MCP auto-install must support `dryRun` mode (default: `true`) — `mai_install` and `mai_remove` must require explicit `{ dryRun: false }` to mutate the user's MCP client config.
- **REQ-033**: `@agentsy/superpowers` must bundle the core superpowers methodology skills (obra/superpowers v5.0.7): `brainstorming`, `git-worktrees`, `writing-plans`, `subagent-driven-development`, `tdd`, `code-review`, `finish-branch`.
- **REQ-034**: Superpowers skills must auto-activate based on context signals: `tdd` when test files are present, `code-review` when diff/PR context is injected, `brainstorming` on open-ended planning prompts.
- **REQ-035**: `@agentsy/slash-commands` must provide a `SlashCommandRegistry` that discovers commands from `.agents/skills/<name>/SKILL.md` files and makes them invocable via `registry.execute('/name', args)`.
- **REQ-036**: `@agentsy/slash-commands` must ship a stock command set: `/skills-find`, `/skills-add`, `/skills-list`, `/mcp-list`, `/mcp-install`, `/caveman`, `/caveman-lite`, `/caveman-ultra`, `/compact`, `/status`, `/new`, `/review`.
- **REQ-037**: Slash command SKILL.md frontmatter must support `allowed-tools`, `description`, `model`, and `argument-hint` fields. Bash execution, file references (`@file`), and positional args (`$1`, `$ARGUMENTS`) must be supported.
- **REQ-038**: `@agentsy/connectors` must provide a `ConnectorGateway` with an `AdapterRegistry` supporting pluggable channel adapters. Gateway model: inbound message → `MessageRouter` → `AgentSessionManager` → outbound delivery via originating adapter.
- **REQ-039**: `@agentsy/connectors` must ship three first-party channel adapters: `SignalAdapter`, `DiscordAdapter`, `SlackAdapter`. Additional adapters installable on demand as `@agentsy/connector-<channel>` packages. See `agentsy-connectors-v1.md` for WhatsApp, Matrix, Telegram, email (IMAP/SMTP), and custom adapter extensions.
- **REQ-040**: `@agentsy/connectors` `AgentSessionManager` must integrate with `@agentsy/session` for per-conversation session persistence and crash-safe resume across channel disconnects.
- **REQ-041**: `@agentsy/connectors` inbound messages must pass through the `@agentsy/runtime` approval engine before invoking destructive tools, using `'auto'` approval mode by default.
- **REQ-042**: `@agentsy/connectors` must support OpenClaw-compatible chat commands as built-in slash commands: `/status`, `/new`, `/reset`, `/compact`, `/think`, `/verbose`, `/usage`.
- **REQ-101**: `@agentsy/agent` `createAgentLoop` MUST support a `planAndExecute` mode option. When enabled, the agent produces an explicit plan artifact before any tool calls; the plan is subject to a configurable `planApproval` hook before execution begins (Plan-Then-Execute pattern, ADR-055).
- **REQ-102**: `@agentsy/agent` MUST emit `ActionTrace` events for every tool call: `{ toolName, args, result, durationMs, turnIndex }`. Consumers register `onActionTrace` handlers to implement kill-switch logic.
- **REQ-108**: `createAgentLoop` MUST support a `humanInTheLoop` approval hook that fires before any destructive tool call (HITL pattern). When set, the agent pauses execution and emits `AwaitingHumanApproval` event with the pending tool call details.

### New Security Requirements

- **SEC-010**: `caveman-shrink` MCP proxy must never alter tool `inputSchema` definitions — only compress `description` strings. Altered schemas must trigger a startup validation error.
- **SEC-011**: `@agentsy/skills` `add(ref)` must validate `ref` against pattern `owner/repo` or a registry slug. Arbitrary URL inputs must be rejected to prevent SSRF via the skills CLI subprocess.
- **SEC-012**: `mai_install` from `@mcpmarket/mcp-auto-install` must default to `dryRun: true` in all `@agentsy/mcp` contexts. Actual installation requires explicit `{ confirm: true }` after user approval.
- **SEC-013**: `@agentsy/connectors` inbound message payloads must be treated as untrusted external input. Content must be sanitized before system prompt injection via the existing `stripXmlContextTags` / `dedupeXmlContext` pipeline.
- **SEC-014**: `@agentsy/connectors` channel adapter credentials (bot tokens, API keys) must be loaded exclusively from environment variables or `@agentsy/runtime` secret store. No credentials in config objects or SKILL.md files.
- **SEC-026**: Every execution path that combines (a) access to private/session data, (b) exposure to untrusted external content (web, email, user input), and (c) network egress capability constitutes a Lethal Trifecta (SRC-30). Such paths MUST break at least one of the three conditions: restrict egress via `egressAllowList`, strip untrusted content before context injection (`stripXmlContextTags`), or limit data scope to non-cross-user.

### New Constraints

- **CON-009**: `@agentsy/caveman`, `@agentsy/skills`, `@agentsy/superpowers`, and `@agentsy/slash-commands` must have zero runtime dependencies beyond `@agentsy/core`. SKILL.md files are static assets, not compiled code.
- **CON-010**: `@agentsy/connectors` channel adapters must list the respective platform SDK as a `peerDependency`, not a hard dependency.
- **CON-011**: `caveman-shrink` MCP proxy must be a standalone Node.js stdio process compatible with MCP 2025-06-18 transport spec. It must not require any `@agentsy/*` packages at runtime.
- **CON-012**: `@agentsy/skills` CLI subprocess calls must use argument arrays — never shell string interpolation — to prevent command injection.
- **CON-023**: All agent-loop-based packages MUST expose explicit stop conditions: `maxIterations`, `maxToolCalls`, and `stopOnTestFailureCount`. No unbounded loops.

### New Guidelines

- **GUD-008**: All bundled SKILL.md files must include `source_url`, `version`, and `license` frontmatter fields pointing to the upstream repository.
- **GUD-009**: All slash commands in the stock set must have a corresponding unit test in `packages/slash-commands/src/*.test.ts`.
- **GUD-010**: Connector adapters must implement the `ChannelAdapter` interface and never directly reference `@agentsy/agent` internals. All agent communication goes through the `AgentSessionManager` contract.
- **GUD-013**: Before building multi-agent systems, validate that a single optimized LLM call with retrieval and in-context examples is insufficient (Anthropic simplicity principle). Add agents only when specialization improves quality or throughput in a measurable way.
- **GUD-014**: Every MCP/local tool definition MUST receive the same engineering effort as system prompts (ACI principle). Tool descriptions must include purpose, parameters, example usage, edge cases, and clear boundaries from similar tools (poka-yoke). Tools are the largest failure surface in agentic systems (SRC-35).
- **GUD-015**: Each `@agentsy` package that invokes an agent loop MUST define an `AGENTS.md` (or equivalent `agentsy.config.md`) at the workspace root describing: how to run tests, lint rules, forbidden mutations, and what counts as "done". Keep under 200 lines; project-specific override section required (SRC-32).
- **GUD-017**: Agent action APIs called by `AgentTaskRunner` and `createAgentLoop` MUST be idempotent by design. Non-idempotent actions must be wrapped in a confirmation gate. Reliability must precede autonomy (SRC-34).
- **GUD-019**: All tool calls exposed by `@agentsy` packages MUST be schema-driven (inputSchema + outputSchema), time-bounded (configurable `toolTimeout`), observable (emit ActionTrace events), and classified as `retryable: boolean`. Non-retryable tools MUST document why (SRC-35).
- **GUD-020**: Agent plans produced by `planAndExecute` mode MUST be inspectable artifacts — not internal model state. Plans MUST be serialized as JSON with fields: `steps[]`, `dependencies{}`, `successCriteria[]`, and `escalationPoints[]` (SRC-35).

---

## 2. Implementation Steps

### Phase 5 — Slash Commands + Skills Management

- **GOAL-005**: Ship `@agentsy/slash-commands` and `@agentsy/skills` as independently installable packages with zero runtime dependencies beyond `@agentsy/core`.

| Task        | Description                                                                                                                                                                                                                                                                                                     | Completed | Date |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-F5-001 | Create `packages/slash-commands/`. Add `package.json` (`@agentsy/slash-commands`, peerDep: `@agentsy/core@workspace:*`), `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`.                                                                                                                                 |           |      |
| TASK-F5-002 | Define `SlashCommandManifest` interface in `packages/slash-commands/src/types.ts`: `name`, `description`, `argumentHint?`, `allowedTools?`, `model?`, `skillPath`. Export from package barrel.                                                                                                                  |           |      |
| TASK-F5-003 | Implement `SlashCommandRegistry` in `packages/slash-commands/src/registry.ts`. Constructor: `skillsRoot: string` (default `.agents/skills`). Methods: `discover(): Promise<SlashCommandManifest[]>`, `get(name)`, `execute(name, args)`.                                                                        |           |      |
| TASK-F5-004 | Implement SKILL.md frontmatter parser in `packages/slash-commands/src/parser.ts`. Parse `allowed-tools`, `description`, `model`, `argument-hint`. Support bash execution markers, file refs (`@file`), positional args (`$1`, `$ARGUMENTS`).                                                                    |           |      |
| TASK-F5-005 | Create stock SKILL.md files under `packages/slash-commands/src/skills/`: `/compact.md`, `/status.md`, `/new.md`, `/review.md` (core session management commands).                                                                                                                                               |           |      |
| TASK-F5-006 | Export `createSlashCommandRegistry(options?)` factory from `packages/slash-commands/src/index.ts`. Options: `{ skillsRoot?: string, additionalSkillPaths?: string[] }`.                                                                                                                                         |           |      |
| TASK-F5-007 | Write unit tests in `packages/slash-commands/src/registry.test.ts`. Cases: discovery, frontmatter parsing, `execute` dispatch, missing command error, argument substitution (`$1`, `$ARGUMENTS`).                                                                                                               |           |      |
| TASK-F5-008 | Create `packages/skills/`. Add `package.json` (`@agentsy/skills`, peerDep: `@agentsy/core@workspace:*`), `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`.                                                                                                                                                 |           |      |
| TASK-F5-009 | Define types in `packages/skills/src/types.ts`: `SkillSearchResult { name, description, author, stars, installCommand, url }`, `SkillListEntry { name, path, version }`, `SkillsManagerOptions { skillsRoot?, registry? }`.                                                                                     |           |      |
| TASK-F5-010 | Implement `SkillsManager` in `packages/skills/src/manager.ts`. Methods: `find(query)`, `add(ref)`, `list()`, `remove(name)`, `update(name)`, `init(path?)`. Spawn `npx skills <subcommand>` via argument array. Validate `ref` against `/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/` before subprocess call (SEC-011). |           |      |
| TASK-F5-011 | Implement `parseSkillsOutput(stdout: string): SkillSearchResult[]` in `packages/skills/src/parser.ts`. Parse table output from `npx skills find`.                                                                                                                                                               |           |      |
| TASK-F5-012 | Export `createSkillsManager(options?: SkillsManagerOptions)` factory from `packages/skills/src/index.ts`.                                                                                                                                                                                                       |           |      |
| TASK-F5-013 | Write unit tests in `packages/skills/src/manager.test.ts`. Mock subprocess calls via `vi.mock`. Test: valid query, valid ref `add`, invalid ref rejection (SEC-011), `list`, `remove`.                                                                                                                          |           |      |
| TASK-F5-014 | Create stock SKILL.md files in `packages/skills/src/skills/`: `/skills-find.md`, `/skills-add.md`, `/skills-list.md`. These become slash commands wrapping `SkillsManager` operations for use within agent sessions.                                                                                            |           |      |
| TASK-F5-015 | Add `@agentsy/slash-commands` and `@agentsy/skills` to turbo dependency graph in `turbo.json`. Confirm packages are covered by `packages/*` glob in `pnpm-workspace.yaml`.                                                                                                                                      |           |      |

### Phase 6 — Caveman + Superpowers

- **GOAL-006**: Ship `@agentsy/caveman` and `@agentsy/superpowers` as static skill bundles with zero runtime deps beyond `@agentsy/core`. Include `caveman-shrink` as a standalone MCP proxy binary.

| Task        | Description                                                                                                                                                                                                                                                                                                                                          | Completed | Date |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-F6-001 | Create `packages/caveman/`. Add `package.json` (`@agentsy/caveman`, peerDep: `@agentsy/core@workspace:*`), `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`.                                                                                                                                                                                    |           |      |
| TASK-F6-002 | Define `CavemanMode` in `packages/caveman/src/types.ts`: `type CavemanMode = 'lite' \| 'full' \| 'ultra' \| 'wenyan-lite' \| 'wenyan-full' \| 'wenyan-ultra'`. Export `DEFAULT_CAVEMAN_MODE: CavemanMode = 'full'`.                                                                                                                                  |           |      |
| TASK-F6-003 | Bundle JuliusBrussee/caveman v1.7.0 SKILL.md files under `packages/caveman/src/skills/`: `caveman.md`, `caveman-lite.md`, `caveman-ultra.md`, `wenyan.md`. Each must include `source_url`, `version: "1.7.0"`, `license: "MIT"` frontmatter (GUD-008).                                                                                               |           |      |
| TASK-F6-004 | Bundle cavecrew subagent SKILL.md files under `packages/caveman/src/skills/cavecrew/`: `investigator.md`, `builder.md`, `reviewer.md`. Each targets ~60% fewer output tokens than vanilla equivalents.                                                                                                                                               |           |      |
| TASK-F6-005 | Create slash command SKILL.md files under `packages/caveman/src/skills/commands/`: `/caveman.md` (activates `full` mode), `/caveman-lite.md`, `/caveman-ultra.md`. These register in the `@agentsy/slash-commands` stock set.                                                                                                                        |           |      |
| TASK-F6-006 | Implement `CavemanManager` in `packages/caveman/src/manager.ts`. Methods: `activate(mode: CavemanMode): SkillContent`, `deactivate(): void`, `getActiveMode(): CavemanMode \| null`, `listSkills(): CavemanSkillManifest[]`. Export `createCavemanManager()` factory.                                                                                |           |      |
| TASK-F6-007 | Create `packages/caveman/src/shrink/`. Implement `caveman-shrink` MCP proxy as standalone Node.js stdio script (`bin/caveman-shrink.js`). Proxy: (1) spawns downstream MCP server process, (2) intercepts `tools/list` responses and compresses `description` fields, (3) validates no `inputSchema` field is altered — startup assertion (SEC-010). |           |      |
| TASK-F6-008 | Implement `compressDescription(text: string): string` in `packages/caveman/src/shrink/compress.ts`. Algorithm: strip filler phrases, abbreviate common words. Never alter content in backtick blocks, URLs, JSON schema keywords.                                                                                                                    |           |      |
| TASK-F6-009 | Write tests in `packages/caveman/src/shrink/compress.test.ts`. Test: code literals preserved, URLs preserved, identifiers preserved, `inputSchema` never mutated, compressed description shorter than original on typical inputs.                                                                                                                    |           |      |
| TASK-F6-010 | Add `"bin": { "caveman-shrink": "./bin/caveman-shrink.js" }` to `packages/caveman/package.json`.                                                                                                                                                                                                                                                     |           |      |
| TASK-F6-011 | Export from `packages/caveman/src/index.ts`: `CavemanMode`, `DEFAULT_CAVEMAN_MODE`, `createCavemanManager`, `compressDescription`, `CAVEMAN_SKILLS_PATH`, `CAVECREW_SKILLS_PATH`.                                                                                                                                                                    |           |      |
| TASK-F6-012 | Write tests in `packages/caveman/src/manager.test.ts`: `activate('full')` returns non-empty SKILL.md string, `activate('ultra')` shorter than `activate('lite')`, `listSkills()` returns all 3 cavecrew variants.                                                                                                                                    |           |      |
| TASK-F6-013 | Create `packages/superpowers/`. Add `package.json` (`@agentsy/superpowers`, peerDep: `@agentsy/core@workspace:*`), `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`.                                                                                                                                                                            |           |      |
| TASK-F6-014 | Bundle obra/superpowers v5.0.7 SKILL.md files under `packages/superpowers/src/skills/`: `brainstorming.md`, `git-worktrees.md`, `writing-plans.md`, `subagent-driven-development.md`, `tdd.md`, `code-review.md`, `finish-branch.md`. Include `source_url`, `version: "5.0.7"`, `license: "MIT"` frontmatter.                                        |           |      |
| TASK-F6-015 | Implement `SuperpowersActivator` in `packages/superpowers/src/activator.ts`. Method `selectSkills(context: SuperpowersContext): SkillManifest[]` examines context signals and returns relevant skill subset.                                                                                                                                         |           |      |
| TASK-F6-016 | Define `SuperpowersContext` in `packages/superpowers/src/types.ts`: `{ hasTestFiles?: boolean, hasDiff?: boolean, isOpenEndedPlan?: boolean, requestedSkills?: string[], projectRoot?: string }`. Export `DEFAULT_SUPERPOWERS_CONTEXT`.                                                                                                              |           |      |
| TASK-F6-017 | Export from `packages/superpowers/src/index.ts`: `SuperpowersContext`, `createSuperpowersActivator`, `SUPERPOWERS_SKILLS_PATH`. Factory: `createSuperpowersActivator(options?: { skillsPath?: string })`.                                                                                                                                            |           |      |
| TASK-F6-018 | Write unit tests in `packages/superpowers/src/activator.test.ts`. Test: `hasTestFiles: true` → `tdd`, `hasDiff: true` → `code-review`, `isOpenEndedPlan: true` → `brainstorming`, `requestedSkills: ['writing-plans']` → `writing-plans` regardless of signals.                                                                                      |           |      |
| TASK-F6-019 | Update `/skills-find` and `/skills-add` stock SKILL.md commands (from Phase 5) to reference `@agentsy/skills` + `@agentsy/superpowers` as default skill sources.                                                                                                                                                                                     |           |      |

### Phase 7 — MCP Server Management

- **GOAL-007**: Extend `@agentsy/mcp` with `@mcpmarket/mcp-auto-install` as a default bundled meta-server. All five `mai_*` tools available in every `MCPOrchestrator` instance. Installation operations require explicit `{ confirm: true }`.

| Task        | Description                                                                                                                                                                                                                                                     | Completed | Date |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-F7-001 | Add `@mcpmarket/mcp-auto-install@^0.2.1` as `devDependency` in `packages/mcp/package.json` (spawned as child process, not imported). Document version pin in `packages/mcp/src/meta-server.ts`.                                                                 |           |      |
| TASK-F7-002 | Implement `MCPAutoInstallServer` in `packages/mcp/src/meta-server.ts`. On `MCPOrchestrator` init, spawn `npx @mcpmarket/mcp-auto-install` as stdio MCP server, register as `__mai__`. Configure `MCP_SETTINGS_PATH` from `MCPOrchestratorOptions.settingsPath`. |           |      |
| TASK-F7-003 | Wrap `mai_install` and `mai_remove` with dryRun enforcement: if `dryRun` not explicitly `false`, inject `{ dryRun: true }` before forwarding. Emit `MaiDryRunEnforced` warning event (SEC-012).                                                                 |           |      |
| TASK-F7-004 | Expose `mai_search`, `mai_details`, `mai_readme` as pass-through (read-only, no dryRun wrapping). Expose `mai_install` and `mai_remove` with dryRun enforcement from TASK-F7-003.                                                                               |           |      |
| TASK-F7-005 | Add `MCPAutoInstallOptions` to `packages/mcp/src/types.ts`: `{ enabled?: boolean, settingsPath?: string, registryPath?: string, allowInstall?: boolean }`. Thread through `MCPOrchestratorOptions`.                                                             |           |      |
| TASK-F7-006 | Add `/mcp-list` and `/mcp-install` stock SKILL.md files to `packages/slash-commands/src/skills/`. `/mcp-list.md` calls `mai_search` + `mai_details`. `/mcp-install.md` calls `mai_install` with explicit confirmation gate via user approval flow.              |           |      |
| TASK-F7-007 | Write integration tests in `packages/mcp/src/meta-server.test.ts`. Test: `mai_search` returns results, `mai_install` without `confirm: true` returns dry-run result, `mai_install` with `confirm: true` blocked unless `allowInstall: true` in options.         |           |      |
| TASK-F7-008 | Update `@agentsy/mcp` package dependency graph entry in `plan/agentsy-platform-v2.md` §8 to note `@mcpmarket/mcp-auto-install` as a child process dependency.                                                                                                   |           |      |

### Phase 8 — Chat Platform Connectors

- **GOAL-008**: Ship `@agentsy/connectors` with `ConnectorGateway` + `AgentSessionManager` + `MessageRouter` core, plus three first-party channel adapters with platform SDKs as peer dependencies.

| Task        | Description                                                                                                                                                                                                                                                                                                                                 | Completed | Date |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-F8-001 | Create `packages/connectors/`. Add `package.json` (`@agentsy/connectors`, peerDeps: `@agentsy/core`, `@agentsy/agent`, `@agentsy/session`, `@agentsy/runtime` all `workspace:*`), `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`.                                                                                                    |           |      |
| TASK-F8-002 | Define core types in `packages/connectors/src/types.ts`: `InboundMessage { channelId, userId, threadId?, text, attachments?, rawPayload }`, `OutboundMessage { channelId, userId, threadId?, text, attachments? }`, `ChannelAdapter<TConfig>` interface with `connect`, `disconnect`, `send`, `onMessage`.                                  |           |      |
| TASK-F8-003 | Implement `MessageRouter` in `packages/connectors/src/router.ts`. Routes inbound messages to correct `AgentSessionManager` instance by `channelId+userId`. Inbound message text passes through `stripXmlContextTags` before forwarding (SEC-013).                                                                                           |           |      |
| TASK-F8-004 | Implement `AgentSessionManager` in `packages/connectors/src/session-manager.ts`. Per `channelId+userId` key: creates or resumes `createAgentLoop` instance backed by `FileSystemSessionStore`. On disconnect: snapshots and persists. On reconnect: resumes from checkpoint (REQ-040). Implements `maxIdleTime` eviction (default: 1 hour). |           |      |
| TASK-F8-005 | Implement built-in chat command handler in `packages/connectors/src/commands.ts`. Recognizes `/status`, `/new`, `/reset`, `/compact`, `/think`, `/verbose`, `/usage` (REQ-042). Handled before forwarding to agent loop. `/new` clears session; `/compact` triggers context compression.                                                    |           |      |
| TASK-F8-006 | Implement `ConnectorGateway` in `packages/connectors/src/gateway.ts`. Factory: `createConnectorGateway(options: ConnectorGatewayOptions)`. Methods: `registerAdapter(adapter)`, `start()`, `stop()`. Composes `MessageRouter`, `AgentSessionManager`, `commands.ts` handler.                                                                |           |      |
| TASK-F8-007 | Implement `TelegramAdapter` in `packages/connectors/src/adapters/telegram.ts`. Peer dep: `grammy@^1`. Config: `{ botToken: string }` from env var `TELEGRAM_BOT_TOKEN` (SEC-014). Implements `ChannelAdapter`.                                                                                                                              |           |      |
| TASK-F8-008 | Implement `DiscordAdapter` in `packages/connectors/src/adapters/discord.ts`. Peer dep: `discord.js@^14`. Config: `{ botToken: string, guildId?: string }` from env var `DISCORD_BOT_TOKEN` (SEC-014). Implements `ChannelAdapter`.                                                                                                          |           |      |
| TASK-F8-009 | Implement `SlackAdapter` in `packages/connectors/src/adapters/slack.ts`. Peer dep: `@slack/bolt@^4`. Config: `{ botToken, appToken, signingSecret }` from env vars `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`, `SLACK_SIGNING_SECRET` (SEC-014). Implements `ChannelAdapter`.                                                                     |           |      |
| TASK-F8-010 | Export from `packages/connectors/src/index.ts`: `createConnectorGateway`, `TelegramAdapter`, `DiscordAdapter`, `SlackAdapter`, `ConnectorGatewayOptions`, `InboundMessage`, `OutboundMessage`, `ChannelAdapter`.                                                                                                                            |           |      |
| TASK-F8-011 | Write unit tests in `packages/connectors/src/gateway.test.ts`. Mock `ChannelAdapter`. Test: message routing to correct session, `/new` resets session, `/status` returns session info, inbound text is sanitized (SEC-013 — verify `<script>` tags are stripped).                                                                           |           |      |
| TASK-F8-012 | Write unit tests in `packages/connectors/src/router.test.ts`. Test: two users on same channel get separate sessions, same user on two channels gets separate sessions, XML injection in message text is stripped.                                                                                                                           |           |      |
| TASK-F8-013 | Append `@agentsy/connectors -> @agentsy/core, @agentsy/agent, @agentsy/session, @agentsy/runtime` to dependency graph in `plan/agentsy-platform-v2.md` §8.                                                                                                                                                                                  |           |      |

### Phase 9 — Cross-Package Slash Command Integration

- **GOAL-009**: Wire all stock slash commands from Phases 5/6/7 into `@agentsy/slash-commands`. Integrate `SlashCommandRegistry` as an optional `@agentsy/agent` plugin. Verify end-to-end.

| Task        | Description                                                                                                                                                                                                                                                                                              | Completed | Date |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-F9-001 | Add `slashCommands?: SlashCommandRegistry` to `AgentLoopOptions` in `packages/agent/src/types.ts`. Agent loop checks incoming user messages for `/`-prefixed commands before any model call.                                                                                                             |           |      |
| TASK-F9-002 | Implement slash command interception in `packages/agent/src/createAgentLoop.ts`. If `userMessage.text.trimStart().startsWith('/')`, extract command and args, call `slashCommands.execute(name, args)`, return result as synthetic assistant message. Non-matching `/`-messages pass through unmodified. |           |      |
| TASK-F9-003 | Populate `/skills-find`, `/skills-add`, `/skills-list` SKILL.md bodies to call `createSkillsManager()` methods and return formatted results.                                                                                                                                                             |           |      |
| TASK-F9-004 | Populate `/mcp-list`, `/mcp-install` SKILL.md bodies. `/mcp-install` must surface confirmation prompt before calling `mai_install` with `{ confirm: true }`.                                                                                                                                             |           |      |
| TASK-F9-005 | Write end-to-end tests in `packages/agent/src/agent.test.ts` (additive). Test: agent loop with `slashCommands` handles `/status`, `/new`, `/caveman`, `/skills-find <query>` — each returns correct result without a model call.                                                                         |           |      |
| TASK-F9-006 | Update `packages/slash-commands/README.md` with usage examples for all 12 stock commands.                                                                                                                                                                                                                |           |      |

---

## 3. Alternatives

- **ALT-006**: Ship caveman as external `npx skills add` step only. Rejected — bundling ensures zero-friction token compression; `npx skills add` remains available for customization.
- **ALT-007**: Import `@mcpmarket/mcp-auto-install` programmatically rather than as child process. Rejected — package is designed as a stdio MCP server; programmatic import couples to unstable internal API.
- **ALT-008**: Implement a custom skills registry crawler. Rejected — vercel-labs/skills maintains 50+ agent-compatible skills; a competing index adds maintenance burden without user benefit.
- **ALT-009**: Implement connectors by embedding OpenClaw or NanoClaw as runtime dependencies. Rejected — both embed opinionated application logic (CLI shells, UI) that conflicts with `@agentsy` being a library.
- **ALT-010**: Bundle all 6 features into existing packages. Rejected — violates REQ-021 (independent installability); consumers who don't need token compression or connectors would pay unnecessary transitive weight.
- **ALT-011**: Implement slash commands as MCP tools. Considered — but slash commands have different invocation semantics (text prefix parsing, no model round-trip) and must intercept before the model call.

---

## 4. Dependencies

- **DEP-005**: `npx skills` (vercel-labs/skills) — spawned as child process by `@agentsy/skills`. Not bundled.
- **DEP-006**: `@mcpmarket/mcp-auto-install@^0.2.1` — spawned as stdio MCP child process by `@agentsy/mcp`. `devDependency` in `packages/mcp/package.json`.
- **DEP-007**: `grammy@^1` — Telegram SDK for `TelegramAdapter`. `peerDependency` in `packages/connectors/package.json`.
- **DEP-008**: `discord.js@^14` — Discord SDK for `DiscordAdapter`. `peerDependency` in `packages/connectors/package.json`.
- **DEP-009**: `@slack/bolt@^4` — Slack Bolt SDK for `SlackAdapter`. `peerDependency` in `packages/connectors/package.json`.
- **DEP-010**: obra/superpowers v5.0.7 SKILL.md files — bundled as static assets. MIT license. No runtime import.
- **DEP-011**: JuliusBrussee/caveman v1.7.0 SKILL.md files — bundled as static assets. MIT license. No runtime import.

---

## 5. Files

### New Package Directories

- **FILE-010**: `packages/caveman/` — new package (TASK-F6-001 through F6-012)
- **FILE-011**: `packages/skills/` — new package (TASK-F5-008 through F5-015)
- **FILE-012**: `packages/superpowers/` — new package (TASK-F6-013 through F6-019)
- **FILE-013**: `packages/slash-commands/` — new package (TASK-F5-001 through F5-007)
- **FILE-014**: `packages/connectors/` — new package (TASK-F8-001 through F8-013)

### Modified Existing Files

- **FILE-015**: `packages/mcp/src/meta-server.ts` — new file in existing `@agentsy/mcp` package (TASK-F7-001 through F7-007)
- **FILE-016**: `packages/mcp/src/types.ts` — additive: `MCPAutoInstallOptions` interface (TASK-F7-005)
- **FILE-017**: `packages/agent/src/types.ts` — additive: `slashCommands?: SlashCommandRegistry` in `AgentLoopOptions` (TASK-F9-001)
- **FILE-018**: `packages/agent/src/createAgentLoop.ts` — additive: slash command interception logic (TASK-F9-002)

### Updated Plan Files

- **FILE-019**: `plan/agentsy-platform-v2.md` — additive: new package entries in §8 dependency graph; reference to REQ-025..REQ-042 and SEC-010..SEC-014
- **FILE-020**: `plan/agentsy-prd-notes.md` — additive: ADR-019 through ADR-025 (see §8 below)
- **FILE-021**: `plan/agentsy-prd.md` — additive: user profiles UP-6, UP-7; requirements rows REQ-025..REQ-042 in §5 table
- **FILE-022**: `plan/agentsy-tech.md` — additive: new package API sections for all 5 new packages
- **FILE-023**: `plan/agentsy-prd-task-plan.md` — additive: Phase 3 with tasks TASK-F5-001 through TASK-F9-006

---

## 6. Testing

- **TEST-001**: `packages/slash-commands/src/registry.test.ts` — discovery, frontmatter parsing, execution, argument substitution
- **TEST-002**: `packages/skills/src/manager.test.ts` — mocked subprocess: valid queries, invalid ref rejection (SEC-011), list/remove
- **TEST-003**: `packages/caveman/src/manager.test.ts` — activate/deactivate, skill content non-empty, `ultra` shorter than `lite`
- **TEST-004**: `packages/caveman/src/shrink/compress.test.ts` — code/URL/identifier preservation, `inputSchema` unchanged, prose compression
- **TEST-005**: `packages/superpowers/src/activator.test.ts` — context-based skill selection for all three auto-activate signals
- **TEST-006**: `packages/mcp/src/meta-server.test.ts` — dryRun enforcement, `mai_search` pass-through, install blocked without `confirm: true`
- **TEST-007**: `packages/connectors/src/gateway.test.ts` — message routing, `/new` session reset, `/status` response, XML injection sanitization
- **TEST-008**: `packages/connectors/src/router.test.ts` — per-user session isolation across channels
- **TEST-009**: `packages/agent/src/agent.test.ts` (additive) — slash command interception, non-command `/`-messages pass through
- **TEST-010**: Adversarial tests in `packages/connectors/src/router.test.ts` — inbound messages with `<script>`, prompt injection patterns, oversized payloads sanitized or rejected

---

## 7. Risks & Assumptions

- **RISK-011**: `npx skills` CLI output format may change, breaking `parseSkillsOutput`. **Mitigation**: Pin version in spawn command; add integration test against live CLI output.
- **RISK-012**: `@mcpmarket/mcp-auto-install` v0.2.1 may have breaking changes in minor releases. **Mitigation**: Pin to `^0.2.1`; monitor changelog.
- **RISK-013**: Telegram/Discord/Slack SDK peer dependencies have large package sizes. **Mitigation**: Listed as peer deps only; consumers install only the adapters they need.
- **RISK-014**: `caveman-shrink` proxy may introduce latency for high-frequency tool calls. **Mitigation**: Proxy is stateless; description compression is one-time on `tools/list` response. Hot path (tool call forwarding) is byte-identical passthrough.
- **RISK-015**: Slash command interception may conflict with legitimate user messages starting with `/` (e.g., URL paths). **Mitigation**: Only match messages where the full first token is a recognized command name. Unrecognized `/`-prefixed messages pass through unmodified.
- **RISK-016**: `AgentSessionManager` session state could grow unbounded. **Mitigation**: `maxIdleTime` eviction from session map (default: 1 hour); evicted sessions persisted to `@agentsy/session` for later resume.
- **ASSUMPTION-008**: obra/superpowers v5.0.7 SKILL.md files are MIT licensed and redistributable. Verify before TASK-F6-014.
- **ASSUMPTION-009**: JuliusBrussee/caveman v1.7.0 SKILL.md files are MIT licensed and redistributable. Verify before TASK-F6-003.
- **ASSUMPTION-010**: `npx skills` CLI is available on demand via npx. `@agentsy/skills` does not bundle the CLI.
- **ASSUMPTION-011**: `@mcpmarket/mcp-auto-install` is backed by the official MCP Registry and search results remain accurate at v0.2.1.
- **ASSUMPTION-012**: Chat connector adapters are session-stateless from the platform SDK perspective. `@agentsy/connectors` manages all conversation state.

---

## 8. New Architecture Decision Records

Append to §2 of `plan/agentsy-prd-notes.md` (additive to ADR-001 through ADR-018):

---

### ADR-019: Caveman Mode as Bundled Skill, Not Runtime Filter

**Decision**: Token compression in `@agentsy/caveman` is implemented as bundled SKILL.md system-prompt injections, not as a post-processing filter on model output tokens.

**Evidence**: JuliusBrussee/caveman v1.7.0 (52.5k stars): the entire compression mechanism is a SKILL.md that instructs the model to produce compressed output. `caveman-shrink` MCP proxy compresses tool _descriptions_ (input to model) — reducing prompt tokens, not output tokens.

**Rationale**: Post-processing token compression would require streaming token-by-token mutation, which is fragile and destructive to structured output (JSON, code). Prompt-side compression leverages the model's own language capabilities at zero inference-time overhead. The two techniques (prompt injection + tool description compression) are orthogonal and complementary.

---

### ADR-020: Skills CLI as Subprocess, Not Library Import

**Decision**: `@agentsy/skills` wraps `npx skills` as a child subprocess rather than importing vercel-labs/skills internals as a library.

**Evidence**: vercel-labs/skills is designed as a CLI tool with no published programmatic Node.js API surface. `@mcpmarket/mcp-auto-install` uses the same pattern.

**Rationale**: Importing CLI internals creates tight coupling to internal module structure that changes without semver guarantees. Subprocess spawning treats the CLI as a stable, versioned interface. Input validation (SEC-011) on the `ref` argument prevents command injection through the subprocess call.

---

### ADR-021: MCP Auto-Install in dryRun by Default

**Decision**: `mai_install` and `mai_remove` in `@agentsy/mcp` default to `dryRun: true`. Actual MCP client config mutation requires explicit two-step: agent calls `mai_install` (returns dry-run plan), then `/mcp-install` slash command surfaces user confirmation gate before calling `mai_install({ confirm: true })`.

**Evidence**: `@mcpmarket/mcp-auto-install v0.2.1` includes `dryRun` option precisely because MCP config file mutation is non-reversible. SEC-012: any tool mutating user MCP client config must require explicit confirmation.

**Rationale**: MCP server installation modifies persistent system configuration files (e.g., `~/.config/claude/mcp.json`). An agent that auto-installs without user awareness creates a supply-chain trust issue. The dry-run default + confirmation fence mirrors the `ask` approval mode applied to all other destructive operations in `@agentsy/runtime`.

---

### ADR-022: Superpowers Skills as Context-Activated, Not Always-On

**Decision**: `@agentsy/superpowers` skills are activated by context signals (presence of test files, diff context, open-ended planning intent) rather than being injected into every agent session's system prompt.

**Evidence**: obra/superpowers v5.0.7 README describes a "progressive activation" model. ADR-001/GUD-002: avoid over-injecting context; add only what the session needs. Always-on superpowers injection adds ~2000 tokens to every prompt unnecessarily.

**Rationale**: Context-based activation via `SuperpowersActivator.selectSkills(context)` injects only the subset relevant to the current task, preserving context window budget.

---

### ADR-023: Slash Commands Intercept Before Model, Not After

**Decision**: `SlashCommandRegistry` in `@agentsy/agent` intercepts `/`-prefixed user messages _before_ any model call. Matched commands execute directly, returning a synthetic assistant message. Unrecognized `/`-prefixed messages pass through unmodified.

**Evidence**: Claude Code SDK: custom commands in `.claude/commands/<name>.md` are resolved before the message is sent to the model. OpenClaw chat commands are intercepted by the gateway layer. Slash command semantics are fully deterministic — no LLM interpretation needed.

**Rationale**: Sending slash commands to the model creates non-deterministic behavior. Pre-model interception ensures `/new` always creates a new session, `/status` always returns metadata, etc. It also eliminates unnecessary LLM round-trips for operational commands.

---

### ADR-024: Connector Gateway as Pure Library (No Embedded Application)

**Decision**: `@agentsy/connectors` is a library providing `ConnectorGateway`, `ChannelAdapter`, `AgentSessionManager`, and three first-party adapter implementations. It includes no CLI binary, HTTP server, or persistent process manager.

**Evidence**: NanoClaw architecture: gateway logic isolated from host process. CON-010: channel adapter platform SDKs are peer dependencies.

**Rationale**: Embedding process management would conflict with the consumer's own deployment model (serverless, containers, desktop). The library exposes the minimal API surface; process management is the consumer's responsibility.

---

### ADR-025: Connector Inbound Messages Sanitized via Existing XML Pipeline

**Decision**: All inbound messages in `@agentsy/connectors` pass through `stripXmlContextTags` and `dedupeXmlContext` before being forwarded to the agent loop, reusing the existing pipeline.

**Evidence**: SEC-006: retrieved wiki content treated as untrusted; `<script>`, HTML injection, executable patterns stripped before injection. SEC-013: inbound connector message payloads are untrusted external input. The existing pipeline in `@agentsy/core/context` is already designed for untrusted LLM-generated XML — the same threat model applies.

**Rationale**: External chat messages (especially from public channels) are high-risk prompt injection vectors. Reusing the existing XML sanitization pipeline avoids a second code path and ensures consistent defense-in-depth.

---

## 9. Package Dependency Graph Additions

Append to `plan/agentsy-platform-v2.md` §8:

```text
@agentsy/slash-commands  ->  @agentsy/core
@agentsy/skills          ->  @agentsy/core
@agentsy/caveman         ->  @agentsy/core
@agentsy/superpowers     ->  @agentsy/core
@agentsy/connectors      ->  @agentsy/core, @agentsy/agent,
                              @agentsy/session, @agentsy/runtime
# @agentsy/mcp (existing) also spawns @mcpmarket/mcp-auto-install
#   as child process (not a package dependency)
```

---

## 10. Related Specifications / Further Reading

- [agentsy-platform-v2.md](./agentsy-platform-v2.md) — master implementation plan (phases MONO-0 through P12)
- [agentsy-prd-notes.md](./agentsy-prd-notes.md) — ADR-001 through ADR-025 (append ADR-019..ADR-025 from §8 above)
- [agentsy-prd.md](./agentsy-prd.md) — product requirements (append REQ-025..REQ-042 from §1 above)
- [agentsy-tech.md](./agentsy-tech.md) — TypeScript API surface (append new package sections)
- [agentsy-prd-task-plan.md](./agentsy-prd-task-plan.md) — task tracking (append Phase 3 rows)
- [JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman) — upstream caveman skill (v1.7.0)
- [vercel-labs/skills](https://github.com/vercel-labs/skills) — Agent Skills open standard CLI and registry
- [@mcpmarket/mcp-auto-install](https://www.npmjs.com/package/@mcpmarket/mcp-auto-install) — MCP server management meta-server (v0.2.1)
- [obra/superpowers](https://github.com/obra/superpowers) — software dev methodology skills (v5.0.7)
- [openclaw/openclaw](https://github.com/openclaw/openclaw) — OpenClaw multi-channel gateway — architecture reference
- [qwibitai/nanoclaw](https://github.com/qwibitai/nanoclaw) — NanoClaw minimal gateway — architecture reference
- [MCP 2025-06-18 Specification](https://modelcontextprotocol.io) — server lifecycle and transport spec
