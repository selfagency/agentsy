---
goal: @agentsy/cli production implementation plan
version: 1.0
date_created: 2026-05-15
last_updated: 2026-05-25
owner: cli-maintainers
status: In progress
tags: [feature, architecture, cli, tui, dogfood, production]
---

# Introduction

![Status: In progress](https://img.shields.io/badge/status-In%20progress-yellow)

This plan defines the canonical implementation order for `@agentsy/cli`, aligned to the dogfood-first production roadmap and standardized on `@oclif/core` for command parsing, plugin lifecycle, help/version/autocomplete flows, and update/discovery behavior.

## 1. Requirements & Constraints

- **REQ-CLI-001**: CLI remains the primary dogfood surface for building and validating platform capabilities.
- **REQ-CLI-002**: Interactive workflows compose renderer-owned Ink components (no duplicated local widget implementations).
- **REQ-CLI-003**: Slash commands and `@` project path insertion are first-class and policy-aware.
- **REQ-CLI-004**: User/workspace config precedence remains deterministic and inspectable.
- **REQ-CLI-005**: Non-interactive output stays machine-readable and stable.
- **REQ-CLI-006**: Command discovery, parsing, help, autocomplete, and plugin loading should be built on `@oclif/core` conventions.
- **REQ-CLI-007**: Interactive terminal UX should incorporate Rune-style patterns: frame-based banners, motion-safe ASCII scenes, reactive status transitions, and composable terminal screens.
- **REQ-CLI-008**: CLI must ship the official superagents plugin as a bundled default while still loading it through the normal plugin registry.
- **REQ-CLI-009**: CLI must provide an agent-mode picker/search flow that merges bundled modes with user/workspace-installed modes discovered from `~/.agents`, project `.agents`, and `~/.config/agentsy`.
- **REQ-CLI-010**: CLI must provide native cmux integration for workspace/surface awareness, terminal input dispatch, and sidebar metadata updates using cmux-supported interfaces.
- **REQ-CLI-011**: CLI should support cmux-native subagent pane orchestration patterns (auto-layout, bounded pane lifecycle, idle cleanup, and queued split retries when workspace size is temporarily constrained).
- **REQ-CLI-012**: CLI must only show/enable cmux integrations when cmux is discovered for the active user workspace (including workspace Applications-folder discovery checks).
- **REQ-CLI-013**: CLI operational logging must use the universal cross-domain logger contract from `@agentsy/observability` (tslog-backed), including correlation IDs for turns, tools, and session transitions.
- **REQ-CLI-014**: CLI network-facing integration tests should use shared MSW (`msw` v2) handlers for deterministic provider/retrieval/connectors mocking.
- **SEC-CLI-001**: Secrets are never persisted in plaintext config.
- **SEC-CLI-002**: Destructive operations remain approval-gated via runtime policy.
- **SEC-CLI-003**: cmux connectivity must default to least privilege (`cmux processes only`/`off` as configured) and must never silently force `allowAll`.
- **CON-CLI-001**: Provider protocol handling stays in `@agentsy/providers`/`@agentsy/core`, not CLI.
- **CON-CLI-002**: Budget enforcement stays in `@agentsy/context`, not duplicated in CLI.
- **CON-CLI-003**: CLI command lifecycle, plugin discovery, autocomplete, and update flows follow `@oclif/core` plus supported oclif plugins rather than custom one-off plumbing.
- **CON-CLI-004**: Rune-style animations and banners remain presentation concerns layered on top of `@agentsy/renderers`, not embedded in command logic.
- **CON-CLI-005**: cmux integration transport should support both Unix socket JSON-RPC and `cmux` CLI invocation, with deterministic preference order and graceful fallback when unavailable.
- **CON-CLI-006**: cmux support remains native-first; tmux-compat shim semantics may be emulated where useful, but CLI must not require `opencode` shadow config or direct dependency on `oh-my-opencode` internals.
- **CON-CLI-007**: cmux command registration/help/autocomplete surfaces must be runtime-gated by discovery state; when undiscovered, cmux commands are hidden or clearly marked unavailable and excluded from default interactive menus.
- **QOS-CLI-001**: Streaming responsiveness and first-token latency must not regress between phases.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-CLI-001: Contract and boundary stabilization on an oclif foundation.

| Task         | Description                                                                                                                                                                                                                                                                                                       | Completed | Date |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-CLI-001 | Align CLI command-routing contracts with `@oclif/core` command classes, `@agentsy/plugins`, `@agentsy/models`, and `@agentsy/renderers`.                                                                                                                                                                          |           |      |
| TASK-CLI-002 | Stabilize typed config contracts and precedence diagnostics for user/workspace/session overlays.                                                                                                                                                                                                                  |           |      |
| TASK-CLI-003 | Publish boundary notes in package docs for ownership of shell composition vs package-owned capabilities.                                                                                                                                                                                                          |           |      |
| TASK-CLI-013 | Define the oclif plugin stack (`plugin-help`, `plugin-not-found`, `plugin-plugins`, `plugin-autocomplete`, `plugin-update`, `plugin-warn-if-update-available`, `plugin-which`, `plugin-commands`, `plugin-search`, `plugin-version`) and map each plugin to the corresponding CLI surface.                        |           |      |
| TASK-CLI-021 | Define cmux integration contracts (transport abstraction, capability probing via `system.capabilities`/`cmux capabilities`, context detection via `CMUX_WORKSPACE_ID`/`CMUX_SURFACE_ID`, socket path/mode handling via `CMUX_SOCKET_PATH`/`CMUX_SOCKET_MODE`, and workspace Applications-folder discovery rules). |           |      |
| TASK-CLI-026 | Define subagent-pane orchestration contracts inspired by cmux `omo` flows (split allocation policy, layout strategy, idle-reap thresholds, queue/retry timing, and compatibility behavior when tmux-like env vars are present).                                                                                   |           |      |

### Implementation Phase 2

- GOAL-CLI-002: Core CLI capability completion with oclif command discovery and Rune-style presentation.

| Task         | Description                                                                                                                                                                                                                                                                                                                         | Completed         | Date       |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ---------- |
| TASK-CLI-004 | Complete interactive shell flows (chat, chooser, panes, approvals, config edit, slash command UX) as oclif commands and command groups. Readline-based chat command built (packages/cli/src/commands/chat.ts) with mock provider support — covers ~10% of full TUI. Need Inked TUI components from @agentsy/renderers for complete. | ⚠️ partial        | 2026-05-25 |
| TASK-012     | DOGFOOD Phase 2: Add E2E streaming test (packages/cli/src/e2e/chat-streaming.e2e.test.ts) validating streamed output from mock provider through full stack.                                                                                                                                                                         |                   |            |
| TASK-095     | DOGFOOD Phase 2: Add shared MSW bootstrap and reusable HTTP handlers for provider-facing CLI/runtime integration tests in @agentsy/testing/src/msw/.                                                                                                                                                                                |                   |            |
| TASK-SIA-014 | SKILLS Phase 7: Add agentsy agents list/show and agentsy skills list/show commands. Add `--agent <id>` flag and `/agent <id>` command.                                                                                                                                                                                              | ?> slash command. |            |
| TASK-CLI-005 | Implement deterministic headless and JSON operation modes.                                                                                                                                                                                                                                                                          |                   |            |
| TASK-CLI-006 | Finalize project-aware context insertion (`@`) with budget-aware previews.                                                                                                                                                                                                                                                          |                   |            |
| TASK-CLI-014 | Add rune-style banner, splash, and motion-safe status components hosted by CLI composition but rendered through `@agentsy/renderers`.                                                                                                                                                                                               |                   |            |
| TASK-CLI-015 | Implement plugin-backed command discovery, `commands` listing, `version`, `help`, `search`, `which`, and autocomplete surfaces using oclif plugin conventions.                                                                                                                                                                      |                   |            |
| TASK-CLI-018 | Add bundled-superagent bootstrap so the official plugin is available out of the box but can still be disabled, overridden, or upgraded like any external plugin.                                                                                                                                                                    |                   |            |
| TASK-CLI-019 | Add `/agent-mode` and startup picker workflows backed by plugin discovery, provenance labels, and persisted default-mode selection.                                                                                                                                                                                                 |                   |            |
| TASK-CLI-022 | Implement native cmux command surfaces (`/cmux status`, `/cmux workspace`, `/cmux surface`, `/cmux notify`) plus automatic context attachment for terminal panes when running inside cmux.                                                                                                                                          |                   |            |
| TASK-CLI-023 | Implement sidebar metadata publishing hooks (status/progress/log) mapped to cmux APIs (`set-status`, `set-progress`, `log` / socket equivalents) with feature flags and motion-safe renderer behavior.                                                                                                                              |                   |            |
| TASK-CLI-027 | Implement cmux-native subagent split orchestration for parallel agents (grid/main-vertical layouts, dynamic resize/reflow, and queued pane creation retries under constrained terminal geometry).                                                                                                                                   |                   |            |
| TASK-CLI-030 | Implement discovery-gated exposure so `/cmux` commands, menu items, and autocomplete/help entries are shown only when cmux is discovered in the active workspace environment; otherwise keep them suppressed by default.                                                                                                            |                   |            |

### Implementation Phase 3

- GOAL-CLI-003: Cross-package integration and dogfood workflows.

| Task         | Description                                                                                                                                                                                    | Completed | Date |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-CLI-007 | Validate end-to-end flows across providers/core/runtime/renderers/session/memory.                                                                                                              |           |      |
| TASK-CLI-008 | Add integration tests for model/provider selection, tool approvals, resume, and retrieval commands.                                                                                            |           |      |
| TASK-CLI-009 | Add operator diagnostics (`status`, `trace`, events) with stable JSON schema output.                                                                                                           |           |      |
| TASK-CLI-016 | Validate oclif plugin loading/update/autocomplete flows and friendly not-found handling across packaged and user-installed plugins.                                                            |           |      |
| TASK-CLI-020 | Validate merged agent-mode discovery across bundled, user, and workspace plugin roots, including precedence, disablement, and fallback behavior.                                               |           |      |
| TASK-CLI-024 | Add integration tests for cmux detection and transport fallback (socket present, CLI-only, unavailable), plus JSON-contract validation for workspace/surface identify and sidebar updates.     |           |      |
| TASK-CLI-028 | Add integration tests for cmux subagent pane lifecycle (spawn/focus/cleanup), idle-agent reap behavior, and retry queue drain when workspace capacity changes.                                 |           |      |
| TASK-CLI-031 | Add tests for discovery gating across workspace states (cmux in Applications folder, cmux outside workspace scope, and no cmux) validating command visibility/help/autocomplete/menu behavior. |           |      |
| TASK-CLI-032 | Integrate CLI command/workflow logging with tslog-backed observability logger factories and validate correlation propagation into trace/event views (`/trace`, `/events`, status JSON).        |           |      |
| TASK-CLI-033 | Migrate CLI integration/e2e suites that mock HTTP to shared MSW handlers and lifecycle setup utilities from `@agentsy/testing`.                                                                |           |      |

### Implementation Phase 4

- GOAL-CLI-004: Hardening and release gates for oclif distribution.

| Task         | Description                                                                                                                                                                                                                         | Completed | Date |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-CLI-010 | Add performance and failure-mode tests for interactive and non-interactive paths.                                                                                                                                                   |           |      |
| TASK-CLI-011 | Ensure package docs and examples match shipped behavior.                                                                                                                                                                            |           |      |
| TASK-CLI-012 | Pass release gates (`pnpm check-types`, `pnpm test`) with CLI suites green.                                                                                                                                                         |           |      |
| TASK-CLI-017 | Validate oclif packaging/release hooks, installer/update behavior, and plugin metadata generation.                                                                                                                                  |           |      |
| TASK-CLI-025 | Harden cmux failure modes (socket permission errors, stale socket path, unsupported methods, mode restrictions) with user-facing diagnostics and non-cmux fallback to standard terminal behavior.                                   |           |      |
| TASK-CLI-029 | Document and validate interoperability behavior when launched from tmux-compat environments (`TMUX`, `TMUX_PANE`, and forwarded config directories), ensuring deterministic behavior without requiring shadow-config bootstrapping. |           |      |

### Implementation Phase 4.5 — Agent selection and skills CLI commands

- GOAL-CLI-004.5: Add agent mode selection and skills/agents CLI commands.

| Task         | Description                                                                                                                                                                                                                   | Completed | Date |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-CLI-034 | Add `--agent <id>` startup flag and `/agent <id>` slash command to select agent mode at launch or mid-session. Integrate with `AgentPickerComponent` from `@agentsy/renderers` for interactive selection when no ID is given. |           |      |
| TASK-CLI-035 | Add `agentsy agents list` and `agentsy agents show <id>` commands — lists discovered agents with provenance, model preferences, tool access summary.                                                                          |           |      |
| TASK-CLI-036 | Add `agentsy skills list` and `agentsy skills show <id>` commands — lists discovered skills with names, descriptions, triggers, activation status.                                                                            |           |      |
| TASK-CLI-037 | Wire agent selection into orchestrator's `createAgentSession` — pass selected agent definition at session construction; store user preference in config.                                                                      |           |      |
| TASK-CLI-038 | Add integration tests: `--agent` flag parsing, `/agent` slash command routing, agent list/show output, skills list/show output, interactive picker flow in TTY mode.                                                          |           |      |

## 3. Acceptance Criteria

- **ACC-CLI-001**: All phase tasks are complete or explicitly deferred with rationale.
- **ACC-CLI-002**: CLI integration tests covering core workflows pass in CI.
- **ACC-CLI-003**: CLI docs/help output match implemented behavior.
- **ACC-CLI-004**: Monorepo gates pass (`pnpm check-types`, `pnpm test`).
- **ACC-CLI-005**: cmux-native flows pass integration tests, including capability probing, workspace/surface targeting, and sidebar metadata publish/clear behavior.
- **ACC-CLI-006**: Parallel subagent pane orchestration in cmux is stable under resize/capacity pressure and cleans up idle panes according to documented policy.
- **ACC-CLI-007**: cmux surfaces are only visible/enabled when discovery succeeds for the active workspace Applications-folder context; undiscovered states do not expose cmux by default.
- **ACC-CLI-008**: CLI logs emitted through observability use the shared tslog-backed schema and carry correlation metadata compatible with cross-package diagnostics.
- **ACC-CLI-009**: Network-bound CLI integration tests use MSW handlers with deterministic request/response fixtures across provider/retrieval flows.

## 4. Sources Synthesized

- `plan/MASTER-IMPLEMENTATION-PLAN.md`
- `plan/IMPLEMENTATION-PRIORITY.md`
- `plan/feature-cli-dogfood-production-order-1.md`
- `https://github.com/oclif/core`
- `https://cmux.com/docs/api`
- `https://cmux.com/docs/agent-integrations/oh-my-opencode`
- `https://mswjs.io/docs`
- `https://tslog.js.org`
- `https://www.npmjs.com/package/@rune-cli/rune`
- `docs/packages/cli.md`
- `packages/cli/README.md`
- `packages/cli/IMPLEMENTATION-PLAN.md`

## 5. Existing Package Deep-Dive (Preserved)

---

## @agentsy/cli — Implementation Plan

## Role in Framework Ecosystem

`@agentsy/cli` is the **human interface** for the terminal. It provides a user-friendly entry point for indexing codebases, managing agents, and engaging in interactive chat sessions. It orchestrates the capabilities of `@agentsy/retrieval`, `@agentsy/core`, and `@agentsy/runtime` into a cohesive command-line experience.

It consumes `@agentsy/renderers` for real-time, ANSI-colored feedback and integrates with `@agentsy/memory` for local-first knowledge persistence.

It owns the human-facing shell workspace composition layer: command routing, interactive configuration editing, pane layout, keybindings, focus management, provider/model workflow composition, and project-aware context insertion.

### Ecosystem Sketch

```text
[ User ]
   |
   v
[ @agentsy/cli ] <--- Command Routing & TUI
   |
   +-----------------------+-----------------------+
   |                       |                       |
   v                       v                       v
[ @agentsy/retrieval ]  [ @agentsy/runtime ]    [ @agentsy/memory ]
(Indexing & Search)     (Agent Execution)       (Local Knowledge)
```

## Fulfillment of Role

The package fulfills its role by providing:

1. **Command Architecture**: A robust routing system (e.g., using `commander`) for various agentic tasks.
2. **Indexing Pipelines**: Multi-modal indexing for files (TS/JS/PY), web content, and conversation history.
3. **Hybrid Search**: A user interface for combining SQL precision with vector similarity.
4. **Rich Rendering**: Support for spinners, progress bars, and streaming markdown via `@agentsy/renderers`.
  1. **Workspace UX composition**: Composes renderer-owned Ink components for dialog, stream events, document/diff viewing, git worktree status, and terminal panes.
  2. **Ink UI base components**: Prefer `@inkjs/ui` primitives for reusable interactive controls (input, select, badge, spinner, progress, alert, lists) and wrap them only when a project-specific composition is required.
5. **Command routing**: Presents plugin-owned slash commands plus `@`-based file/folder insertion from the active project.
6. **Configuration Authority**: Durable user config at `~/.agentsy/agentsy.yml` and workspace/project overrides with interactive editing.

## Detailed Functionality

### 1. Command Architecture (`src/commands/`)

- **Interactive Mode**: A TUI-focused interactive shell (OpenCode pattern) supporting:
  - **Agent Mode Selection**: Using a picker/search flow to switch between bundled and discovered agent modes (including `research`, `plan`, `agent`, and user/project-installed modes).
  - **Shared widget stack**: Reuse `@inkjs/ui` primitives for searchable selects, inputs, badges, lists, alerts, spinners, and progress controls in command UX.
  - **Natural Language Interaction**: Streaming chat interface.
  - **Permission Prompts**: Explicit user approval for file edits or shell commands.
- **Headless Mode**: Support for single-command execution (e.g., `agentsy -p "your question"`).
- **Slash commands and interactive commands**:
  - `/help`: List available commands.
  - `/auth`: Manage provider authentication.
  - `/agent-mode`: Search and select installed agent modes.
  - `/cmux ...` (discovery-gated): Inspect cmux capability state, target workspace/surface context, and publish notifications/status for active runs only when cmux is discovered for the active workspace.
  - `/model`: Switch between configured models.
  - `/status`: Show current agent and session state.
  - `/config`, `/settings`: Edit persistent configuration interactively.
  - `/model search`, `/model select`, `/model refine`: Search and refine provider/model choice through CLI-hosted renderer surfaces.
  - `/provider search`: Discover provider backends and health.
  - `/memory ...`, `/trace`, `/events`, `/terminal`, `/worktrees`: Workspace and operator commands.
  - Canonical manifests, aliases, and discovery metadata for slash commands live in `@agentsy/plugins`; CLI owns parsing, completion, help presentation, and routing.
- **Project path insertion**:
  - `@path` in chat input opens fuzzy file/folder chooser scoped to project root.
  - Selection preview shows file summary, token estimate, and whether expansion exceeds current context budget.

### 2. Indexing Strategy (`src/indexing/`)

- **Mechanism**: Pluggable indexers (File, Structure, Web, Conversation).
- **Key Logic**: Uses AST parsing for code files to extract functions, types, and dependencies (Syntactic Chunking).

### 3. TUI & REPL composition (`src/ui/`)

- **Mechanism**: Consumes `@agentsy/renderers` subpaths and composes them into a shell workspace.
- **Functionality**:
  - Real-time chunk-by-chunk display of LLM responses.
  - Specialized rendering for tool calls and thinking blocks.
  - Interactive prompts for human-in-the-loop approvals.
  - Hosts Ink chat transcript components for assistant/user turns and streaming cursor state.
  - Hosts Ink panes for document viewing, diff inspection, git worktree status, and terminal sessions.
  - Hosts provider/model chooser UI with search, filter, refine, and local/cloud toggles.

### 4. Configuration & Project Instructions (`src/config/`, `src/project/`)

- **Persistent user config**: `~/.agentsy/agentsy.yml` stores non-secret preferences.
- **Workspace/project config**: discover `.agentsy/agentsy.yml`, `.agents/AGENTS.md`, `.github/copilot-instructions.md`, and project-local skills/instruction directories.
- **Precedence**:
  1. built-in defaults
  2. user config `~/.agentsy/agentsy.yml`
  3. workspace/project config
  4. session state
  5. inline slash-command overrides
- **Security boundary**: secrets must be referenced via `@agentsy/secrets`; config file never stores provider tokens in plaintext.

### 5. Ownership boundaries (canonical)

- **`@agentsy/renderers`** owns Ink component implementations, display widgets, and pane primitives.
- **`@agentsy/plugins`** owns slash-command manifests, discovery metadata, aliases, and registry composition.
- **`@agentsy/models` + `@agentsy/providers`** own provider/model search, probing, scoring, and refinement contracts.
- **`@agentsy/cli`** owns shell composition, input handling, focus management, command dispatch, and interactive workflow orchestration.

## Logic & Data Flow

### 1. The "Chat" Workflow

1. User runs `agentsy chat`.
2. CLI initializes `@agentsy/runtime` with the requested agent config.
3. CLI enters a loop:
   - Read user input.
   - Assemble context via `@agentsy/retrieval` and `@agentsy/memory`.
   - Dispatch to runtime.
   - Stream response to terminal via `@agentsy/renderers`.
   - Save interaction to `@agentsy/session` for persistence.

### 2. The "Index" Workflow

1. User runs `agentsy index .`.
2. CLI identifies the project type and selects the appropriate indexers.
3. Indexers parse files, generate embeddings via `@agentsy/core/universal-client`, and store them in the local SQLite/Vector DB managed by `@agentsy/retrieval`.

## Key Interfaces

### CLIContext

```typescript
export interface CLIContext {
  config: AgentsyConfig;
  stores: {
    memory: MemoryStore;
    session: SessionStore;
    retrieval: RetrievalStore;
  };
  observability: ObservabilityEngine;
  tokenManager: TokenManager;
}
```

### CommandHandler

```typescript
export interface CommandHandler {
  name: string;
  description: string;
  options: CommandOption[];
  execute(args: string[], context: CLIContext): Promise<void>;
}
```

## Implementation Details

### Local-first Philosophy

All CLI operations should work offline by default, using local SQLite and Vector stores. Remote sync should be an opt-in feature.

### Streaming Correctness

The CLI must handle ANSI sequences correctly, ensuring that streaming output doesn't break the terminal's scrollback or overwrite previous lines unexpectedly.

## Sources Synthesized

`agentsy-features-v1.md`, `agentsy-platform-v2.md`, `research/CLI-TOOLS-ANALYSIS.md`, `docs/examples/cli-log-summarizer.md`, `packages/cli/IMPLEMENTATION-PLAN.md`.

```typescript
interface HybridSearchEngine {
  // SQL queries for precise filtering
  sqlQueries: {
    byProject: "SELECT * FROM documents WHERE project_root = ?";
    byFileType: "SELECT * FROM documents WHERE file_type = ?";
    byDependencies: "SELECT * FROM documents WHERE JSON_search(dependencies, ?, ?)";
    byAccessPattern: "SELECT * FROM documents ORDER BY access_count DESC";
    byRecency: "SELECT * FROM documents WHERE updated_at > ?";
  };

  // Vector search for semantic similarity
  vectorSearch: {
    embeddingModel: "text-embedding-3-small" | "local-embeddings";
    similarityThreshold: 0.7;
    maxResults: 10;
    rerankByRecency: boolean;
    rerankByFrequency: boolean;
  };

  // Combined query optimization
  hybridQueries: {
    semanticPrecise: "Vector + SQL by project/file type";
    contextualAware: "Vector + conversation history + recent access";
    dependencyAware: "Vector + import graph + package structure";
    trending: "Vector + access frequency + recency";
  };
}
```

### Smart Context Building

Learn from sourcebot and memelord patterns:

```typescript
interface ContextBuilder {
  // Multi-level context hierarchy
  contextLevels: {
    immediate: {
      file: string | null;
      directory: string | null;
      imports: string[];
      exports: string[];
    };
    project: {
      structure: FileTree;
      dependencies: PackageGraph;
      recentChanges: FileChange[];
    };
    related: {
      similarFiles: Document[];
      referencedFiles: Document[];
      dependentFiles: Document[];
    };
    conversational: {
      recentTopics: string[];
      decisions: Decision[];
      patterns: Pattern[];
    };
  };

  // Context optimization
  optimization: {
    maxTokens: 4096;
    priorityWeighting: {
      currentFile: 1.0;
      imports: 0.8;
      directory: 0.6;
      similar: 0.4;
      conversational: 0.3;
      projectOverview: 0.2;
    };
    deduplication: true;
    relevanceScore: boolean;
  };
}
```

## Implementation Priority

### Phase 1: Core Database Layer

```bash
# Implement SQLite + Vector store
pnpm add sqlite3 sqlite-vec
pnpm add @types/sqlite3

# Core database schema
database/index.ts
database/schema.ts
database/migrations/
```

### Phase 2: Indexing Pipeline

```bash
# File system indexing
indexing/file-indexer.ts
indexing/structure-indexer.ts
indexing/dependency-tracker.ts

# Web content indexing
indexing/web-indexer.ts
indexing/api-docs-indexer.ts
```

### Phase 3: Search Engine

```bash
# Hybrid search implementation
search/hybrid-search.ts
search/sql-queries.ts
search/vector-search.ts
search/context-builder.ts
```

### Phase 4: CLI Integration

```bash
# CLI commands for indexing and search
commands/index.ts
commands/search.ts
commands/context.ts
commands/chat.ts
commands/slash/
config/
tui/components/
```

### Phase 5: Interactive Workspace UX

```bash
# Ink components and workspace interactions
tui/components/chat/
tui/components/stream-events/
tui/components/document/
tui/components/diff/
tui/components/git/
tui/components/terminal/
tui/components/model-picker/
tui/input/
project/
```

### Phase 6: Persistent Settings and Project-Specific Instructions

```bash
# Persistent config + project overlays
config/schema.ts
config/store.ts
config/migrate.ts
project/discovery.ts
project/instructions.ts
project/skills.ts
```

## Additional Required Capabilities

- **Ink provider/model search-select-refine components** for capability-aware local/cloud model picking.
- **`@` file/folder attachment flow** for project-scoped context insertion with ignore rules and token budget previews.
- **Interactive config editing** for `~/.agentsy/agentsy.yml` plus diagnostics explaining merged settings and instruction precedence.
- **Project-specific instructions/skills ingestion** from repository-local instruction files and packaged skill manifests.

## Key Features from References

### From SQLite.ai Blog

- RAG on SQLite with vector extensions
- Efficient hybrid search combining SQL + vectors
- Real-time indexing with FTS5

### From turso.tech

- Edge SQLite for vector search
- Scalable document retrieval
- Production-ready vector operations

### From sqlite-ollama-rag

- Local embedding generation
- Efficient chunking strategies
- Context-aware retrieval

### From RAG-SQLITE-VEC-MODULE

- SQLite vector extensions
- High-performance similarity search
- Optimized storage format

### From sourcebot

- Code-aware indexing
- Dependency graph tracking
- Semantic code understanding

### From inferable SQLite RAG

- RAG checkpointer for conversations
- Context persistence
- Multi-turn conversation support

### From superset-sh/superset

- Large-scale document handling
- Efficient metadata management
- Advanced filtering capabilities

### From spiceai

- Time-series document tracking
- Change detection
- Historical context preservation

### From agentic RAG with SQLite checkpointer

- Agent-specific context tracking
- Decision persistence
- Workflow-aware retrieval

## Usage Examples

### Initialize indexing for a project

```bash
agentsy index --project ./my-project --deep
agentsy index --web https://docs.example.com --recursive
agentsy index --conversation --history 50
```

### Smart context-aware chat

```bash
agentsy chat --context-aware --max-tokens 4096
agentsy chat --context ./src/utils.ts --include-dependencies
agentsy chat --context recent --limit 10
```

### Search and retrieve

```bash
agentsy search "authentication patterns" --type code --limit 5
agentsy search --similar ./src/auth.ts --threshold 0.8
agentsy search --web --api-docs --query "react hooks"
```

### Interactive development

```bash
agentsy dev --server --index-watch
agentsy dev --repl --context-auto
agentsy dev --tui --file-tree --preview
```

## Architecture Benefits

1. **Unified Storage**: Single SQLite database for all documents
2. **Hybrid Search**: SQL precision + Vector similarity
3. **Context Awareness**: File, project, and conversational context
4. **Real-time Updates**: Live indexing and reindexing
5. **Production Ready**: Based on proven SQLite + Vector patterns
6. **Extensible**: Pluggable indexing and search strategies
7. **Efficient**: Optimized for large codebases
8. **Developer Friendly**: Natural language and code-aware search

This implementation provides the foundation for intelligent agent conversations that understand code structure, project context, and conversation history.
