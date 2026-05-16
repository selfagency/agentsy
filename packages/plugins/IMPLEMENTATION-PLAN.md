---
goal: @agentsy/plugins production implementation plan
version: 1.0
date_created: 2026-05-15
last_updated: 2026-05-15
owner: plugins-maintainers
status: In progress
tags: [feature, architecture, plugins, registry, commands]
---

# Introduction

![Status: In progress](https://img.shields.io/badge/status-In%20progress-yellow)

This plan defines the production implementation order for `@agentsy/plugins` as the extension and slash-command registry authority.

## 1. Requirements & Constraints

- **REQ-PLUGINS-001**: Plugin manifests define capabilities, permissions, aliases, and compatibility metadata.
- **REQ-PLUGINS-002**: Registry discovery/loading/conflict behavior is deterministic.
- **REQ-PLUGINS-003**: Slash-command registration supports help metadata and policy-aware interception.
- **REQ-PLUGINS-004**: Lifecycle events are observable and test-covered.
- **REQ-PLUGINS-005**: First-party plugins must be distributable and loadable through the exact same manifest/registry path as third-party plugins.
- **REQ-PLUGINS-006**: The official superagents plugin must define reusable `research`, `plan`, and `agent` modes with provenance metadata and independently consumable APIs.
- **REQ-PLUGINS-007**: Plugin discovery must merge bundled plugins with user/project plugin directories, including `~/.agents`, project `.agents`, and `~/.config/agentsy`.
- **SEC-PLUGINS-001**: Privileged plugin capabilities are deny-by-default.
- **SEC-PLUGINS-002**: Third-party plugin content is validated and sandboxed at activation boundaries.
- **CON-PLUGINS-001**: CLI owns shell UX composition; plugins own manifests and registry.
- **CON-PLUGINS-002**: Tool execution remains in runtime/tools despite plugin discovery.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-PLUGINS-001: Contract stabilization.

| Task             | Description                                                                                                                                                   | Completed | Date |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-PLUGINS-001 | Finalize plugin manifest schema and capability model contracts.                                                                                               |           |      |
| TASK-PLUGINS-002 | Stabilize slash-command registry/discovery APIs and alias resolution behavior.                                                                                |           |      |
| TASK-PLUGINS-003 | Document package boundaries with CLI/orchestrator/runtime.                                                                                                    |           |      |
| TASK-PLUGINS-013 | Extend manifest schema for official-plugin provenance, mode metadata, picker labels, and install-source markers (`bundled`, `user`, `workspace`, `external`). |           |      |

### Implementation Phase 2

- GOAL-PLUGINS-002: Core registry implementation.

| Task             | Description                                                                                                                                | Completed | Date |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ---- |
| TASK-PLUGINS-004 | Implement plugin loading, activation filtering, and conflict resolution.                                                                   |           |      |
| TASK-PLUGINS-005 | Implement command manifests, aliases, and discoverability/help metadata.                                                                   |           |      |
| TASK-PLUGINS-006 | Add capability-scoped activation and policy negotiation hooks.                                                                             |           |      |
| TASK-PLUGINS-014 | Implement official superagents plugin packaging so it can be installed independently but also shipped as a bundled default plugin for CLI. |           |      |
| TASK-PLUGINS-015 | Add discovery loaders for bundled plugins plus user/project plugin roots (`~/.agents`, project `.agents`, `~/.config/agentsy`).            |           |      |

### Implementation Phase 3

- GOAL-PLUGINS-003: Integration and testing.

| Task             | Description                                                                                                                     | Completed | Date |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-PLUGINS-007 | Integrate slash-command pathways with CLI input/help and orchestrator interception.                                             |           |      |
| TASK-PLUGINS-008 | Add integration tests for command routing, plugin capability filtering, and rejection messaging.                                |           |      |
| TASK-PLUGINS-009 | Emit plugin lifecycle telemetry via observability hooks.                                                                        |           |      |
| TASK-PLUGINS-016 | Add tests for agent-mode manifest discovery, precedence, provenance labeling, and merged bundled/user/workspace picker results. |           |      |

### Implementation Phase 4

- GOAL-PLUGINS-004: Hardening and release gates.

| Task             | Description                                                             | Completed | Date |
| ---------------- | ----------------------------------------------------------------------- | --------- | ---- |
| TASK-PLUGINS-010 | Add regression suites for plugin compatibility and conflict edge cases. |           |      |
| TASK-PLUGINS-011 | Align docs and plugin-author guidance.                                  |           |      |
| TASK-PLUGINS-012 | Pass package and monorepo release gates.                                |           |      |

## 3. Acceptance Criteria

- **ACC-PLUGINS-001**: Plugin manifest and registry behaviors are deterministic and test-validated.
- **ACC-PLUGINS-002**: CLI/orchestrator/runtime integration paths are production-ready.
- **ACC-PLUGINS-003**: Security and release gates pass.

## 4. Sources Synthesized

- `plan/MASTER-IMPLEMENTATION-PLAN.md`
- `plan/feature-cli-dogfood-production-order-1.md`
- `docs/packages/plugins.md`
- `packages/plugins/README.md`
- `packages/plugins/IMPLEMENTATION-PLAN.md`

## 5. Existing Package Deep-Dive (Preserved)

---

## @agentsy/plugins — Implementation Plan

## Role in Framework Ecosystem

`@agentsy/plugins` is the **capability marketplace** of the framework. It provides a standardized integration point for tools, agent templates, and specialized execution modes. It allows the framework to grow its feature set without bloating the core packages.

It is consumed by `@agentsy/runtime` (for tool discovery) and `@agentsy/orchestrator` (for workflow node templates).

### Ecosystem Sketch

```text
[ @agentsy/orchestrator ]    [ @agentsy/runtime ]
         |                         |
         +------------+------------+
                      |
                      v
             [ @agentsy/plugins ]
             /        |         \
            v         v          v
  [ Tool Libs ] [ Agent Temp ] [ Official/3P Modes ]
  (Slack, GitHub) (Researcher) (Superagents, etc.)
```

## Fulfillment of Role

The package fulfills its role by providing:

1. **Standardized Tool Registry**: A common interface for registering and discovering tools. Each tool exports `./client`, `./executor`, and `./ExecutionRuntime` (LobeHub pattern).
2. **Plugin Lifecycle Management**: Hooks for loading, initializing, and unloading extensions.
3. **Agent Templates**: Reusable agent configurations (instructions, model settings, tool sets).
4. **Feature Discovery**: Mechanisms for agents to discover available capabilities based on context signals.
5. **Extension Provider Architecture**: Self-contained modules with `AGENTS.md` and standardized interfaces (OpenClaw pattern).
6. **Workspace Skill Integration**: Discovery and activation of project-specific skills and instruction bundles alongside installed/global skills.
7. **Slash command registry**: Canonical manifests, aliases, discovery metadata, and command registry for `/`-prefixed interactive behavior consumed by CLI and orchestrator.

## Detailed Functionality

### 1. Plugin System (`src/system/`)

- **Hooks**: `load`, `initialize`, `activate`, `deactivate`, and `unload`.
- **Registry**: `PluginHost` manages the collection of active plugins and their permissions.

### 2. Tool Registry (`src/registry/`)

- **Responsibility**: Centralized management of available tools.
- **Mechanism**: `ToolRegistry` class.
- **Functionality**:
  - Registering tools with JSON schemas (compiler-generated from TypeScript types).
  - Standardized tool exports: `./client` (client-side metadata), `./executor` (server-side logic), `./ExecutionRuntime` (environment requirements).
  - Discovering tools by name or capability description.
  - Managing tool versions and deprecations.

### 3. Official plugins and specialized modes

- **Official superagents plugin**: A first-party plugin distributed through the same registry path as external plugins and prepackaged with the CLI.
- **Reusable mode set**:
  - `research`: iterative research loops, citations, and source strategy selection
  - `plan`: clarification, review, and implementation-plan generation
  - `agent`: execution workflow with investigate/review/test/ship discipline
- **Rule**: third-party inspirations inform these modes, but their original brand names are not the canonical product-facing modes in Agentsy.

### 4. Feature-Based Architecture

- **Core Package Plus Installable Features**: The base package plus additional installable feature packages (Kestrel Sovereign pattern).
- **Feature Registry**: A runtime registry (TOML/JSON) for feature discovery and state management (`packages/plugins/src/registry/feature_registry.toml`).
- **Scaffolding**: CLI tools for generating new feature skeletons (`agentsy feature scaffold <name>`).

### 5. Tool Categories

- **Tool Categories**: Tools organized by category (search, knowledge, filesystem, etc.) for easier discovery.

### 6. Capability Extensions

- **Skills Support**: Full support for `SKILL.md` files as defined in the Agent Skills open standard.
- **Entry Points**: Features register themselves via package entry points or explicit manifests.

### 6.1 Slash command manifests and discovery

- **Canonical home**: `/` command manifests, aliases, help metadata, and command categories belong in `@agentsy/plugins`.
- **Boundary**: CLI owns input parsing/completion and help presentation, while orchestrator/runtime own interception and execution semantics.
- **Registry output**: expose command descriptors suitable for interactive help, keybinding surfaces, permission policy checks, and workspace-specific command enablement.

### 7. Skill Discovery and Activation (Agentspan-inspired)

Agentspan-style skill management is a good fit for the plugin layer because it already owns capability discovery and activation.

- **Skill discovery**: search installed skills by name, description, and capability tags.
- **Context-based activation**: enable skills only when the current task matches their scope.
- **Permission scoping**: attach explicit tool and filesystem permissions to each skill bundle.
- **Collaboration metadata**: preserve skill provenance, version, and activation history for review.

**Implementation notes:**

- Keep the model lightweight: adapt the concepts, do not depend on Agentspan at runtime.
- Surface skills through the existing registry and manifest flow.
- Let orchestrator/runtime decide activation; plugins should expose metadata and safe defaults.

### 8. Project-Specific Skills and Workspace Extensions

- **Workspace skill discovery**: discover project-local skills/manifests from repository-scoped locations and merge them with installed/global skills.
- **Instruction/skill affinity**: attach project-specific instruction bundles to matching skills so CLI/runtime can activate them together.
- **Interactive selection**: expose metadata required by CLI for skill search/select/refine UX.
- **Policy scoping**: ensure project-specific skills inherit filesystem/tool restrictions from workspace policy and user configuration.

## Logic & Data Flow

### 1. Tool Discovery Flow

1. At startup, `@agentsy/runtime` queries the `PluginHost` for available tools.
2. The host filters tools based on the agent's configuration and security policy.
3. The resulting tool definitions are injected into the agent's system prompt.

### 2. Mode Activation Flow

1. An agent is initialized with a specific `mode` (e.g., `caveman`).
2. The `PluginHost` looks up the corresponding `AgentModeFactory`.
3. The factory wraps the standard agent loop with specialized instructions, filters, and event handlers.

### 3. Workspace skill flow (new)

1. CLI discovers project-local skills and instructions from the active repository.
2. Plugin registry merges them with installed/global skills using explicit precedence and provenance markers.
3. Orchestrator/runtime request context-relevant skills.
4. CLI can present search/select/refine controls for skills and activate them interactively.

## Key Interfaces

### ToolRegistry

```typescript
export interface ToolRegistry {
  register(
    name: string,
    definition: ToolDefinition,
    handler: ToolHandler
  ): void;
  unregister(name: string): void;
  list(): ToolDefinition[];
  get(
    name: string
  ): { definition: ToolDefinition; handler: ToolHandler } | undefined;
}
```

### Plugin

```typescript
export interface Plugin {
  name: string;
  version: string;
  capabilities: string[];
  onActivate(context: PluginContext): Promise<void>;
  onDeactivate(): Promise<void>;
}
```

### Extension

```typescript
export interface Extension {
  id: string;
  name: string;
  initialize(): Promise<void>;
  execute(params: unknown): Promise<ExtensionResult>;
}
```

### WorkspaceSkillManifest

```typescript
export interface WorkspaceSkillManifest {
  id: string;
  source: "workspace" | "user" | "bundled";
  path: string;
  capabilities: string[];
  instructionFiles: string[];
  priority: number;
}
```

## Implementation Details

### Bundled Skills

Specialized modes like `caveman` should ship their `SKILL.md` files as static assets within the package. The `PluginHost` must be able to parse these files and convert them into active tool/prompt context.

The same host must also discover and validate project-local skill bundles so a repository can ship its own instructions, skills, and extension defaults without modifying the global installation.

### Coverage CI

Every plugin or scaffold must have at least one minimal test (`src/index.test.ts`) to ensure the Turbo coverage pipeline remains green.

## Sources Synthesized

`agentsy-agents-v1.md`, `agentsy-features-v1.md`, `DECISION-LOG.md`, `REVISED-ARCHITECTURE.md`, `packages/plugins/IMPLEMENTATION-PLAN.md`.

---

## @agentsy/caveman — Token Compression Skill Bundle

### Requirements

- **REQ-025**: Ship `@agentsy/caveman` as a zero-dep static skill bundle with modes: `lite`, `full`, `ultra`, `wenyan-lite`, `wenyan-full`, `wenyan-ultra`.
- **REQ-026**: Bundle cavecrew subagent SKILL.md files targeting ~60% fewer output tokens.
- **REQ-027**: Ship `caveman-shrink` as a standalone stdio MCP proxy binary that compresses tool descriptions without altering `inputSchema`.
- **CON-011**: `caveman-shrink` must not require any `@agentsy/*` packages at runtime.
- **SEC-010**: `inputSchema` must never be altered by `caveman-shrink`; enforce with startup validation assertion.
- **ADR-019**: Caveman as bundled SKILL.md, not runtime filter. Post-processing token compression is fragile and destructive; prompt-side compression leverages the model's own language capabilities at zero inference-time overhead.
- **ASSUMPTION-009**: JuliusBrussee/caveman v1.7.0 SKILL.md files are MIT licensed and redistributable. Verify before TASK-F6-003.
- **DEP-011**: JuliusBrussee/caveman v1.7.0 SKILL.md files — bundled as static assets. MIT license. No runtime import.

### Types (`src/types.ts`)

```ts
type CavemanMode =
  | "lite"
  | "full"
  | "ultra"
  | "wenyan-lite"
  | "wenyan-full"
  | "wenyan-ultra";
const DEFAULT_CAVEMAN_MODE: CavemanMode = "full";
```

### Implementation Tasks

| Task        | Description                                                                                                                                                                                                                                                                                         |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TASK-F6-001 | Create `packages/caveman/`. Add `package.json` (`@agentsy/caveman`, peerDep: `@agentsy/core@workspace:*`), `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`.                                                                                                                                   |
| TASK-F6-002 | Define `CavemanMode` in `packages/caveman/src/types.ts`. Export `DEFAULT_CAVEMAN_MODE: CavemanMode = 'full'`.                                                                                                                                                                                       |
| TASK-F6-003 | Bundle JuliusBrussee/caveman v1.7.0 SKILL.md files under `packages/caveman/src/skills/`: `caveman.md`, `caveman-lite.md`, `caveman-ultra.md`, `wenyan.md`. Each must include `source_url`, `version: "1.7.0"`, `license: "MIT"` frontmatter (GUD-008).                                              |
| TASK-F6-004 | Bundle cavecrew subagent SKILL.md files under `packages/caveman/src/skills/cavecrew/`: `investigator.md`, `builder.md`, `reviewer.md`. Each targets ~60% fewer output tokens than vanilla equivalents.                                                                                              |
| TASK-F6-005 | Create slash command SKILL.md files under `packages/caveman/src/skills/commands/`: `/caveman.md`, `/caveman-lite.md`, `/caveman-ultra.md`.                                                                                                                                                          |
| TASK-F6-006 | Implement `CavemanManager` in `packages/caveman/src/manager.ts`. Methods: `activate(mode: CavemanMode): SkillContent`, `deactivate(): void`, `getActiveMode(): CavemanMode \| null`, `listSkills(): CavemanSkillManifest[]`. Export `createCavemanManager()` factory.                               |
| TASK-F6-007 | Create `packages/caveman/src/shrink/`. Implement `caveman-shrink` as standalone Node.js stdio script (`bin/caveman-shrink.js`). Proxy: (1) spawns downstream MCP server, (2) compresses `description` fields in `tools/list` responses, (3) validates no `inputSchema` altered — startup assertion. |
| TASK-F6-008 | Implement `compressDescription(text: string): string` in `packages/caveman/src/shrink/compress.ts`. Never alter content in backtick blocks, URLs, JSON schema keywords.                                                                                                                             |
| TASK-F6-009 | Write tests in `packages/caveman/src/shrink/compress.test.ts`. Test: code literals preserved, URLs preserved, `inputSchema` never mutated, compressed description shorter than original on typical inputs.                                                                                          |
| TASK-F6-010 | Add `"bin": { "caveman-shrink": "./bin/caveman-shrink.js" }` to `packages/caveman/package.json`.                                                                                                                                                                                                    |
| TASK-F6-011 | Export from `packages/caveman/src/index.ts`: `CavemanMode`, `DEFAULT_CAVEMAN_MODE`, `createCavemanManager`, `compressDescription`, `CAVEMAN_SKILLS_PATH`, `CAVECREW_SKILLS_PATH`.                                                                                                                   |
| TASK-F6-012 | Tests in `packages/caveman/src/manager.test.ts`: `activate('full')` returns non-empty SKILL.md string, `activate('ultra')` shorter than `activate('lite')`, `listSkills()` returns all 3 cavecrew variants.                                                                                         |

### Risks

- **RISK-014**: `caveman-shrink` proxy may introduce latency. Mitigation: proxy is stateless; description compression is one-time on `tools/list` response. Hot path (tool call forwarding) is byte-identical passthrough.

---

## @agentsy/skills — Skills Manager

### Requirements

- **REQ-029**: `SkillsManager` provides `find`, `add`, `list`, `remove`, `update`, `init` operations by spawning `npx skills` as subprocess.
- **REQ-030**: All `ref` arguments validated against `/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/` before subprocess call.
- **CON-012**: CLI subprocess calls must use argument arrays (never shell string interpolation).
- **SEC-011**: Validate `ref` against regex before any subprocess call to prevent injection.
- **ADR-020**: Skills CLI as subprocess, not library import. `vercel-labs/skills` has no published programmatic API; subprocess treats CLI as a stable versioned interface. Input validation on `ref` prevents injection.
- **DEP-005**: `npx skills` (vercel-labs/skills) — spawned as child process. Not bundled.
- **ASSUMPTION-010**: `npx skills` CLI is available on demand via npx. `@agentsy/skills` does not bundle the CLI.
- **RISK-011**: `npx skills` CLI output format may change. Mitigation: pin version in spawn command; add integration test against live CLI output.

### Types (`src/types.ts`)

```ts
interface SkillSearchResult {
  name: string;
  description: string;
  author: string;
  stars: number;
  installCommand: string;
  url: string;
}
interface SkillListEntry {
  name: string;
  path: string;
  version: string;
}
interface SkillsManagerOptions {
  skillsRoot?: string;
  registry?: string;
}
```

### Implementation Tasks

| Task        | Description                                                                                                                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| TASK-F5-008 | Create `packages/skills/`. Add `package.json` (`@agentsy/skills`, peerDep: `@agentsy/core@workspace:*`), `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`.                                                    |
| TASK-F5-009 | Define types in `packages/skills/src/types.ts`: `SkillSearchResult`, `SkillListEntry`, `SkillsManagerOptions`.                                                                                                     |
| TASK-F5-010 | Implement `SkillsManager` in `packages/skills/src/manager.ts`. Spawn `npx skills <subcommand>` via argument array. Validate `ref` against `/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/` before subprocess call (SEC-011). |
| TASK-F5-011 | Implement `parseSkillsOutput(stdout: string): SkillSearchResult[]` in `packages/skills/src/parser.ts`. Parse table output from `npx skills find`.                                                                  |
| TASK-F5-012 | Export `createSkillsManager(options?: SkillsManagerOptions)` factory from `packages/skills/src/index.ts`.                                                                                                          |
| TASK-F5-013 | Unit tests in `packages/skills/src/manager.test.ts`. Mock subprocess via `vi.mock`. Test: valid query, valid ref `add`, invalid ref rejection (SEC-011), `list`, `remove`.                                         |
| TASK-F5-014 | Create stock SKILL.md files in `packages/skills/src/skills/`: `/skills-find.md`, `/skills-add.md`, `/skills-list.md`.                                                                                              |

---

## Extracted Technical API Surface (from `plan/agentsy-tech.md`)

### Ownership mapping from legacy standalone sections

The technical design sections previously describing standalone packages (`@agentsy/caveman`, `@agentsy/skills`, `@agentsy/superpowers`, `@agentsy/slash-commands`) are now mapped to plugin-owned extension domains.

### Plugin extension responsibilities

- Skill-bundle loading and manifest validation.
- Context-activated mode selection (caveman/superpowers-style behavior).
- Slash-command pre-model interception strategy as plugin-registered command manifests.
- Extension safety guarantees: schema-preserving transforms and explicit execution gating for mutating operations.
