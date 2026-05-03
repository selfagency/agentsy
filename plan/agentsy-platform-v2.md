---
goal: '@agentsy monorepo platform — turborepo restructure + full implementation plan'
version: '2.0'
date_created: '2026-05-02'
last_updated: '2026-05-02'
owner: 'selfagency'
status: 'Planned'
tags: ['architecture', 'monorepo', 'turbo', 'migration', 'feature', 'memory', 'mcp', 'tui']
---

# @agentsy monorepo platform — Complete Implementation Plan v2

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

This plan covers the full transformation of `@selfagency/llm-stream-parser` into the **`@agentsy` npm org monorepo**: a collection of composable, independently installable TypeScript packages that together form a complete agent-infrastructure platform. It supersedes v1 which targeted a single `@selfagency/agentsy` package. The `@agentsy` npm org is now available and all packages will publish under it.

The plan integrates architectural insights from Claude Code, OpenCode, Hermes Agent, nanobot, Gemini CLI, OpenAI Codex, vercel/ai, and tanstack/ai. It is organized into four tracks executed in an optimized interleaved sequence: **Track MONO** (monorepo infrastructure), **Track R** (package identity + repositioning), **Track P** (core agent infrastructure), and **Track X** (extensibility + blended memory).

**Platform identity:** `@agentsy/*` — a family of Node.js 22 ESM-first packages. Consumers install only what they need. All packages are individually tree-shakeable with dual ESM/CJS output.

---

## 1. Requirements & Constraints

### Functional Requirements

- **REQ-001**: All packages must publish under the `@agentsy` npm org. Package names follow the pattern `@agentsy/<domain>`.
- **REQ-002**: Old package `@selfagency/llm-stream-parser` must remain installable as a compatibility shim re-exporting all existing public APIs unchanged.
- **REQ-003**: All existing subpath exports from `@selfagency/llm-stream-parser` must be available on the shim package without modification to consumer import paths.
- **REQ-004**: Agent loop (`createAgentLoop`) in `@agentsy/agent` must support hook injection points: `beforeStep`, `afterStep`, `beforeToolCall`, `afterToolCall`, `onError`, `onAbort`.
- **REQ-005**: Agent loop must call `memoryEngine.startTask()` at loop start and `memoryEngine.endTask()` at loop end when a memory engine is provided.
- **REQ-006**: `LLMStreamProcessor` in `@agentsy/processor` must emit new events: `ContextWindowWillOverflow`, `ChatCompressed`, `LoopDetected`, `Citation`, `Retry`, `InvalidStream`.
- **REQ-007**: Context window manager (`@agentsy/context-manager`) must monitor token budget, trigger `compressConversation()` when threshold is reached, and emit `ContextWindowWillOverflow` before compression.
- **REQ-008**: Cost tracker (`@agentsy/cost-tracker`) must maintain a provider pricing map, enforce optional budget limits, and emit `CostThresholdExceeded` events.
- **REQ-009**: Parallel tool executor must support bounded concurrency, per-call `AbortSignal`, and deterministic result ordering.
- **REQ-010**: Tool approval engine must implement `allow` / `ask` / `deny` / `auto` modes identical to Claude Code's permission model.
- **REQ-011**: Session store (`@agentsy/session`) must persist `StreamSnapshot` checkpoints durably (default: local filesystem JSON), enabling deterministic resume on crash.
- **REQ-012**: MCP orchestration (`@agentsy/mcp`) must conform to MCP 2025-06-18 spec: server lifecycle (start/stop/restart), capability negotiation, trust-level filtering.
- **REQ-013**: Provider strategy (`@agentsy/providers`) must support a capability matrix (context window, vision, tool calling, streaming) and configurable fallback chains.
- **REQ-014**: Multi-agent orchestration must support parent→child subagent spawning with a configurable max depth cap to prevent runaway recursion.
- **REQ-015**: Skill system must be compatible with the Agent Skills open standard (`.agents/skills/**/SKILL.md`, progressive disclosure).
- **REQ-016**: Memory engine (`@agentsy/memory`) must implement the 3-layer blended architecture: Layer 0 raw event log, Layer 1 Karpathy-style wiki, Layer 2 vector RAG over the wiki.
- **REQ-017**: Vector RAG must index **wiki pages** (synthesized artifacts), NOT raw session events — this is the core Karpathy architectural invariant.
- **REQ-018**: `memory_search()`, `memory_capture()`, `memory_list()`, `memory_stats()`, `memory_lint()` must be exposed as OpenBrain-compatible tool surface from `@agentsy/memory`.
- **REQ-019**: Retrieved memory context must be injected via the existing `splitLeadingXmlContext` / `dedupeXmlContext` / `stripXmlContextTags` pipeline using `<memory_context>` tags.
- **REQ-020**: `openaiResponses` provider must be routable through `@agentsy/normalizers` and `@agentsy/processor` pipeline.
- **REQ-021**: Each package must be independently installable; consumers who only use stream parsing primitives should not transitively pull in `@agentsy/memory` or `@agentsy/mcp`.
- **REQ-022**: Turborepo must orchestrate all build, test, typecheck, and lint tasks with proper dependency-aware caching.
- **REQ-023**: `StopCondition` predicates (`isStepCount`, `hasToolCall`, `isLoopFinished`) must be exported from `@agentsy/agent` (vercel/ai pattern).
- **REQ-024**: `prepareStep` callback and `mergeCallbacks` utility must be available in `@agentsy/agent` for per-step dynamic reconfiguration (vercel/ai pattern).

### Security Requirements

- **SEC-001**: All tool calls with destructive potential (file overwrite, shell exec, network egress) must pass through the approval engine in `@agentsy/runtime` before execution.
- **SEC-002**: Path confinement: file-system tools must be restricted to a configurable workspace root; path traversal sequences (`../`) must be rejected.
- **SEC-003**: Secret redaction: any string matching a known secret pattern (API key regex, bearer token regex) must be scrubbed from log output and telemetry.
- **SEC-004**: Plugin manifests must carry a signed checksum; the runtime must verify the signature before loading.
- **SEC-005**: Memory scope isolation: project-scoped wiki pages must not be accessible to session-scoped or global-scoped retrieval queries without explicit cross-scope permission.
- **SEC-006**: Retrieved wiki pages must be treated as untrusted LLM-generated content; any `<script>`, HTML injection, or executable pattern within a retrieved page must be stripped before injection into system prompt context.
- **SEC-007**: MCP server connections must be filtered by trust level (`trusted` / `untrusted` / `readonly`); untrusted servers may not invoke destructive built-in tools.
- **SEC-008**: SSRF prevention: HTTP fetch tools must validate destination URLs against a configurable egress allowlist.
- **SEC-009**: Prompt injection detection: retrieved memory content carrying instruction-override patterns must trigger a `MemoryInjectionSuspected` warning event and drop the chunk.

### Constraints

- **CON-001**: Runtime target is Node.js ≥ 22 (CI confirmed). Bun compatibility is acceptable but not required.
- **CON-002**: Module system is ESM-first (`"type": "module"`). All relative imports in `.ts` source use `.js` extensions.
- **CON-003**: TypeScript strict mode with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `isolatedModules`. Zero `any` types.
- **CON-004**: Toolchain: pnpm workspaces, turbo, tsup (dual output per package), vitest, oxlint, oxfmt, Taskfile commands.
- **CON-005**: No runtime dependencies may be added without explicit justification. Peer dependencies preferred over hard dependencies for optional integrations.
- **CON-006**: `@agentsy/core` must have zero runtime dependencies beyond Node.js built-ins; it is the dependency-free foundation.
- **CON-007**: libSQL/Turso is the default vector store backend for `@agentsy/retrieval` Layer 2; the backend must be swappable via configuration interface.
- **CON-008**: Turborepo remote caching is optional but the pipeline must be configured to support it (Vercel Remote Cache or self-hosted).

### Guidelines

- **GUD-001**: Factory functions (`create*`) over direct class instantiation for all stateful modules.
- **GUD-002**: Silent failure by default in stream-processing hot paths; recoverable errors emit warning events rather than throwing.
- **GUD-003**: Options objects with optional properties and `??` defaults; export `DEFAULT_*` constants for all tunables.
- **GUD-004**: Each package has its own `packages/<domain>/src/index.ts` barrel export and its own `package.json` subpath exports.
- **GUD-005**: Tests colocated as `*.test.ts` in each package's `src/`; adversarial/malformed-input test cases required for all parser and memory modules.
- **GUD-006**: Inter-package dependencies use the pnpm workspace protocol (`"@agentsy/core": "workspace:*"`), NOT relative paths.
- **GUD-007**: Each package's `package.json` includes `"publishConfig": { "access": "public" }` for `@agentsy` scoped publishing.

### Patterns to Follow

- **PAT-001**: Claude Code `QueryEngine` pattern: `@agentsy/processor` + `@agentsy/agent` compose the streaming tool-call loop with retry logic and token counting.
- **PAT-002**: OpenCode client/server architecture: `@agentsy/agent` is the server-side runtime; UI surfaces are downstream consumers.
- **PAT-003**: Hermes Agent closed learning loop: `startTask → report → endTask → synthesize` lifecycle in `@agentsy/memory`.
- **PAT-004**: nanobot lightweight core: memory and skills are context injections, not orchestration layers; `@agentsy/agent` stays readable.
- **PAT-005**: Gemini CLI conversation checkpointing: `StreamSnapshot` + `@agentsy/session` enables deterministic crash-safe resume.
- **PAT-006**: Codex `codex-rs` safety model: `@agentsy/runtime` enforces `allow/ask/deny` per tool.
- **PAT-007**: Karpathy wiki: compiled wiki is a maintained artifact in `@agentsy/memory`; vector-indexed by `@agentsy/retrieval`.
- **PAT-008**: vercel/ai `StopCondition` predicates: async predicates in `@agentsy/agent` control loop termination declaratively, not imperatively.
- **PAT-009**: tanstack/ai `StreamProcessor` per-message state: `@agentsy/processor` tracks each message's streaming state independently in a `Map`.
- **PAT-010**: tanstack/ai `AgentLoopStrategy` combinators: `maxIterations(n)`, `untilFinishReason([...])`, `combineStrategies([...])` exported from `@agentsy/agent`.

---

## 2. Implementation Steps

> Execution order: MONO-0 → MONO-1 → R0 → P0 → R1+R2 (parallel) → P1 → X1+X2 (parallel) → P2 → P3 → P4 → P5 → P6 → R3 → X3+X4 (parallel) → P7 → P8 → X5 → X6 → X7 → P9 → P10 → P11 → R4 → X8 → P12

---

### Phase MONO-0 — Turborepo Workspace Bootstrap (blocking)

- **GOAL-MONO-0**: Establish the monorepo scaffold before any source migration. All subsequent phases depend on a working Turborepo workspace with per-package build pipelines.

| Task          | Description                                                                                                                                                                                                                                                  | Completed | Date |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ---- |
| TASK-M0-001   | Add `turbo` to root `package.json` `devDependencies`. Add `turbo run build`, `turbo run test`, `turbo run typecheck`, `turbo run lint` scripts to root `package.json`. Set `"packageManager": "pnpm@9"` if not already set.                                  |           |      |
| TASK-M0-002   | Create `turbo.json` at repo root with tasks: `build` (`dependsOn: ["^build"]`, `outputs: ["dist/**"]`), `typecheck` (`dependsOn: ["^build"]`), `test` (`dependsOn: ["build"]`), `lint` (no deps), `format` (no deps). Set `"ui": "tui"`.                    |           |      |
| TASK-M0-003   | Update `pnpm-workspace.yaml`: set `packages: ["packages/*"]`. Remove or archive any previous workspace config.                                                                                                                                               |           |      |
| TASK-M0-004   | Create `packages/tsconfig/` with `base.json` (strict TS settings from current `tsconfig.json`: strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes, verbatimModuleSyntax, isolatedModules, target ES2022, moduleResolution bundler) and `library.json` (extends base, composite: true, declarationMap: true). Publish as `@agentsy/tsconfig`. |           |      |
| TASK-M0-005   | Create the 16 package directories under `packages/`: `core/`, `normalizers/`, `processor/`, `agent/`, `adapters/`, `ag-ui/`, `runtime/`, `context-manager/`, `cost-tracker/`, `session/`, `mcp/`, `providers/`, `memory/`, `retrieval/`, `telemetry/`, `shim/`. |           |      |
| TASK-M0-006   | For each of the 16 packages, create a `package.json` stub with: `name` (`@agentsy/<domain>` or `@selfagency/llm-stream-parser` for shim), `version: "0.3.0"`, `type: "module"`, `"publishConfig": { "access": "public" }`, `scripts: { build, test, typecheck, lint }` delegating to `tsup`, `vitest`, `tsc --noEmit`, `oxlint`. |           |      |
| TASK-M0-007   | For each package, create `tsconfig.json` extending `@agentsy/tsconfig/library.json`; set `rootDir: "./src"`, `outDir: "./dist"`. Add package references to root `tsconfig.json` using TypeScript project references.                                         |           |      |
| TASK-M0-008   | For each package, create `tsup.config.ts` with dual ESM/CJS output, `.d.ts` generation, and `external` array listing all `@agentsy/*` sibling packages (to prevent bundling internals). Mirror the current root `tsup.config.ts` pattern.                   |           |      |
| TASK-M0-009   | For each package, create `vitest.config.ts` extending the root vitest config pattern. Colocate test files as `src/**/*.test.ts`.                                                                                                                             |           |      |
| TASK-M0-010   | Update root `Taskfile.yaml`: add tasks `mono:build` (`turbo run build`), `mono:test` (`turbo run test`), `mono:typecheck` (`turbo run typecheck`), `mono:lint` (`turbo run lint`). Keep existing single-package tasks for backward compat during migration.  |           |      |
| TASK-M0-011   | Verify workspace resolves: run `pnpm install` from repo root; confirm all 16 packages appear in `pnpm list --depth 0`.                                                                                                                                       |           |      |

---

### Phase MONO-1 — Source Migration (blocking, after MONO-0)

- **GOAL-MONO-1**: Move all existing `src/` module directories into their corresponding `packages/*/src/` directories. Update all cross-module imports to use workspace package names. Verify the full build still passes.

**Migration mapping (source → destination package):**

| Source directory | Destination package |
|---|---|
| `src/xml-filter/`, `src/sse/`, `src/thinking/`, `src/tool-calls/`, `src/context/`, `src/formatting/`, `src/markdown/`, `src/structured/`, `src/recovery/`, `src/types/` (new), `src/vendor/`, `src/ui/` | `@agentsy/core` |
| `src/normalizers/` | `@agentsy/normalizers` |
| `src/processor/`, `src/pipeline/` | `@agentsy/processor` |
| `src/agent/` | `@agentsy/agent` |
| `src/adapters/` | `@agentsy/adapters` |
| `src/ag-ui/` | `@agentsy/ag-ui` |

| Task          | Description                                                                                                                                                                                                               | Completed | Date |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-M1-001   | Copy `src/xml-filter/`, `src/sse/`, `src/thinking/`, `src/tool-calls/`, `src/context/`, `src/formatting/`, `src/markdown/`, `src/structured/`, `src/recovery/`, `src/vendor/`, `src/ui/` into `packages/core/src/`. Create `packages/core/src/index.ts` barrel re-exporting all modules. |           |      |
| TASK-M1-002   | Copy `src/normalizers/` into `packages/normalizers/src/`. Add `"@agentsy/core": "workspace:*"` to `packages/normalizers/package.json` dependencies. Update all internal imports.                                          |           |      |
| TASK-M1-003   | Copy `src/processor/` and `src/pipeline/` into `packages/processor/src/`. Add `"@agentsy/core": "workspace:*"` and `"@agentsy/normalizers": "workspace:*"` as dependencies. Update imports.                              |           |      |
| TASK-M1-004   | Copy `src/agent/` into `packages/agent/src/`. Add `"@agentsy/core": "workspace:*"` and `"@agentsy/processor": "workspace:*"` as dependencies. Update imports.                                                             |           |      |
| TASK-M1-005   | Copy `src/adapters/` into `packages/adapters/src/`. Add `"@agentsy/core": "workspace:*"` and `"@agentsy/agent": "workspace:*"` as dependencies.                                                                           |           |      |
| TASK-M1-006   | Copy `src/ag-ui/` into `packages/ag-ui/src/`. Add `"@agentsy/core": "workspace:*"` and `"@agentsy/processor": "workspace:*"` as dependencies.                                                                             |           |      |
| TASK-M1-007   | Create `packages/shim/src/index.ts` that re-exports `* from '@agentsy/core'`, `* from '@agentsy/processor'`, `* from '@agentsy/agent'`, `* from '@agentsy/adapters'`, `* from '@agentsy/ag-ui'`. Add all five as peer dependencies. |           |      |
| TASK-M1-008   | Update all internal cross-module imports across all packages to use workspace package names (`@agentsy/core`, etc.) instead of relative `../` paths.                                                                      |           |      |
| TASK-M1-009   | Remove old `src/` directories from repo root (archive to `src/_legacy/` temporarily if needed during migration). Update root `src/index.ts` and `src/index.test.ts` to import from `@agentsy/*` packages.                |           |      |
| TASK-M1-010   | Run `pnpm install && turbo run build` from repo root. All 16 packages must build successfully. Fix any import resolution or circular dependency issues.                                                                    |           |      |
| TASK-M1-011   | Run `turbo run typecheck`. All packages must pass TypeScript strict-mode checks. Fix all errors.                                                                                                                           |           |      |
| TASK-M1-012   | Run `turbo run test`. All existing tests must pass in their new package locations.                                                                                                                                         |           |      |

---

### Phase R0 — Package Identity & @agentsy Org (blocking, after MONO-1)

- **GOAL-R0**: Finalize all package names, versions, and npm org configuration. Publish all packages to the `@agentsy` npm org for the first time.

| Task        | Description                                                                                                                                                                                                               | Completed | Date |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-R0-001 | Verify npm org `@agentsy` is claimed and the `selfagency` npm user has publish access. Run `npm org ls @agentsy` to confirm.                                                                                              |           |      |
| TASK-R0-002 | Set `version: "0.3.0-alpha.0"` in all 15 `@agentsy/*` package `package.json` files. Set shim `@selfagency/llm-stream-parser` to `"0.3.0-alpha.0"` as well.                                                               |           |      |
| TASK-R0-003 | Add `"repository"`, `"homepage"`, `"keywords"`, `"license": "MIT"` to each package `package.json`. All pointing to the same repo root with appropriate `directory` field.                                                  |           |      |
| TASK-R0-004 | Configure `.npmrc` at repo root with `@agentsy:registry=https://registry.npmjs.org`. Verify `publishConfig.access: "public"` is set on all packages.                                                                     |           |      |
| TASK-R0-005 | Update `README.md` at repo root to reflect the `@agentsy` monorepo identity: list all packages with one-line descriptions and install commands.                                                                           |           |      |
| TASK-R0-006 | Create per-package `README.md` stubs with: package name, one-line description, install command, basic usage snippet, link to monorepo root docs.                                                                         |           |      |
| TASK-R0-007 | Update `.github/workflows/release.yml` and `tests.yml` to use `turbo run build/test/typecheck` instead of per-package task commands. Add `TURBO_TOKEN` and `TURBO_TEAM` secrets for remote cache (optional but scaffold). |           |      |
| TASK-R0-008 | Run `turbo run build` to produce `dist/` in all packages. Verify all subpath exports resolve.                                                                                                                             |           |      |

---

### Phase R1 — Shim Deprecation Notice

- **GOAL-R1**: Communicate the migration path from `@selfagency/llm-stream-parser` to `@agentsy/*` packages without breaking existing consumer installs.

| Task        | Description                                                                                                                                                                                                  | Completed | Date |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ---- |
| TASK-R1-001 | Add `"deprecated": "Migrated to @agentsy/* monorepo packages — see https://github.com/selfagency/llm-stream-parser#migration"` to `packages/shim/package.json`.                                              |           |      |
| TASK-R1-002 | Write `packages/shim/README.md` with a full migration guide mapping old import paths to new `@agentsy/*` equivalents.                                                                                        |           |      |
| TASK-R1-003 | Create `docs/migration.md` at repo root documenting the `@selfagency/llm-stream-parser` → `@agentsy/*` migration with `sed` one-liners for common import rewrites.                                           |           |      |

---

### Phase R2 — Library Repositioning

- **GOAL-R2**: Clearly communicate the library-first, monorepo mission in all public-facing documentation.

| Task        | Description                                                                                                                                                           | Completed | Date |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-R2-001 | Rewrite `docs/index.md` to reflect `@agentsy` positioning: "composable agent infrastructure — one org, many packages, bring your own app."                           |           |      |
| TASK-R2-002 | Update `docs/getting-started.md` to lead with selective package installation and `createAgentLoop` usage; show the minimal install (`@agentsy/agent`).               |           |      |
| TASK-R2-003 | Add `docs/architecture.md` describing: the package dependency graph (as Mermaid diagram), the layer separation (core → normalizers → processor → agent → extensions). |           |      |
| TASK-R2-004 | Add `docs/packages.md` with a reference table of all 15 `@agentsy/*` packages: name, description, key exports, install size, peer deps.                              |           |      |

---

### Phase P0 — Architecture Contract + Security Baseline (blocking, after R0)

- **GOAL-P0**: Freeze the public API contracts, event model, and security invariants before any new module is built. All contracts live in `@agentsy/core`; agent-specific contracts live in `@agentsy/agent`.

| Task        | Description                                                                                                                                                                                                                                              | Completed | Date |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-P0-001 | In `packages/core/src/types/events.ts`: extend existing `EventType` enum with `CONTEXT_WINDOW_WILL_OVERFLOW`, `CHAT_COMPRESSED`, `LOOP_DETECTED`, `CITATION`, `RETRY`, `INVALID_STREAM`, `COST_THRESHOLD_EXCEEDED`, `MEMORY_INJECTION_SUSPECTED`.       |           |      |
| TASK-P0-002 | In `packages/core/src/types/hooks.ts`: define `HookEvent`, `HookDecision` (`allow`/`ask`/`deny`/`defer`), `HookContext`, `HookResult` interfaces.                                                                                                        |           |      |
| TASK-P0-003 | In `packages/core/src/types/memory.ts`: define `MemoryStore`, `MemoryRetriever`, `MemoryFeedback`, `MemoryMaintenance` interfaces (Layer 0/1/2 contracts).                                                                                               |           |      |
| TASK-P0-004 | In `packages/core/src/types/skills.ts`: define `SkillManifest` (name, description, file, triggers, schema) compatible with Agent Skills open standard.                                                                                                  |           |      |
| TASK-P0-005 | In `packages/core/src/types/plugins.ts`: define `PluginManifest` (id, version, checksum, tools, hooks, entrypoint) compatible with Claude plugin subset.                                                                                                 |           |      |
| TASK-P0-006 | In `packages/core/src/types/providers.ts`: define `ProviderCapability` matrix (`contextWindow`, `supportsVision`, `supportsTools`, `supportsStreaming`, `costPerInputToken`, `costPerOutputToken`) and `ProviderStrategy` interface.                     |           |      |
| TASK-P0-007 | In `packages/core/src/types/approval.ts`: define `ApprovalMode` union (`'allow' \| 'ask' \| 'deny' \| 'auto' \| 'plan'`), `ApprovalRequest`, `ApprovalResponse`, `ApprovalEngine` interface. Include `'plan'` as 4th production mode (tool-call dry-run). |           |      |
| TASK-P0-008 | In `packages/agent/src/types.ts`: add `StopCondition` async predicate type `(state: AgentLoopState) => Promise<boolean>` and update `AgentLoopOptions` to accept `stopConditions?: StopCondition[]`. Export `isStepCount(n)`, `hasToolCall()`, `isLoopFinished()` built-in predicates. |           |      |
| TASK-P0-009 | In `packages/agent/src/types.ts`: add `prepareStep?: (step: StepContext) => Promise<Partial<AgentLoopOptions>>` hook to `AgentLoopOptions`. Add `mergeCallbacks(base, override)` utility to merge settings-level and call-level hooks without override. |           |      |
| TASK-P0-010 | Export all new `@agentsy/core` types through `packages/core/src/types/index.ts`. Export all new `@agentsy/agent` types through `packages/agent/src/index.ts`.                                                                                           |           |      |
| TASK-P0-011 | Write unit tests in `packages/core/src/types/types.test.ts` for all new type narrowing helpers and discriminated unions.                                                                                                                                  |           |      |

---

### Phase P1 — Quick Wins (parallel with R1/R2)

- **GOAL-P1**: Ship fast unblocking fixes and additions that don't require new packages.

| Task        | Description                                                                                                                                                                  | Completed | Date |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-P1-001 | In `packages/processor/src/pipeline/createPipeline.ts`: add `openaiResponses` to `NormalizerProvider` union; wire to `packages/normalizers/src/openaiResponses.ts`.         |           |      |
| TASK-P1-002 | In `packages/core/src/structured/autoRepair.ts`: add `strategy: 'fast' \| 'safe' \| 'aggressive'` option with strategy-driven backoff behavior.                             |           |      |
| TASK-P1-003 | In `packages/adapters/package.json`: move `cli-markdown` to `peerDependencies` with optional peer flag; guard import with dynamic `import()` in `packages/adapters/src/`.  |           |      |
| TASK-P1-004 | In `packages/adapters/src/vscode.ts`: mark as `@deprecated` via JSDoc; add migration note pointing to the `@agentsy/mcp` adapter pattern.                                  |           |      |
| TASK-P1-005 | In `packages/agent/src/createAgentLoop.ts`: fix `stepUsage` accumulation reset to zero at the start of each step.                                                           |           |      |

---

### Phase P2 — Event Vocabulary Completion

- **GOAL-P2**: Emit the missing lifecycle events from `LLMStreamProcessor` in `@agentsy/processor` so consumers can react to all meaningful state transitions.

| Task        | Description                                                                                                                                                                                                        | Completed | Date |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ---- |
| TASK-P2-001 | In `packages/processor/src/LLMStreamProcessor.ts`: add `ContextWindowWillOverflow` emission when token count exceeds configurable `contextWindowWarningThreshold` (default: 90% of model max).                    |           |      |
| TASK-P2-002 | Add `ChatCompressed` event emission after `compressConversation()` completes (wired from `@agentsy/context-manager`, Phase P3).                                                                                    |           |      |
| TASK-P2-003 | Add `LoopDetected` event emission in `packages/agent/src/createAgentLoop.ts` when `parametersEqual()` doom-loop detection fires. Currently only logs; must emit typed event.                                       |           |      |
| TASK-P2-004 | Add `Citation` event: emitted when a tool result or memory retrieval result is injected as grounded context. Payload: `{ source: string, content: string, score?: number }`.                                       |           |      |
| TASK-P2-005 | Add `Retry` event: emitted before each provider retry attempt. Payload: `{ attempt: number, maxAttempts: number, delayMs: number, reason: string }`.                                                               |           |      |
| TASK-P2-006 | Add `InvalidStream` event: emitted when a stream chunk fails schema validation. Payload: `{ chunk: unknown, error: string }`.                                                                                       |           |      |
| TASK-P2-007 | Migrate `LLMStreamProcessor` per-message state to a `Map<messageId, MessageStreamState>` (tanstack/ai pattern). Add `prepareAssistantMessage()` → `ensureAssistantMessage()` lazy-creation lifecycle with whitespace-only pruning on finalize. |           |      |
| TASK-P2-008 | Add `StreamProcessor.replay(recording)` method for deterministic test replay of recorded chunk sequences (tanstack/ai pattern).                                                                                    |           |      |
| TASK-P2-009 | Write tests for all 6 new events plus per-message state map, lazy message creation, and replay functionality in `packages/processor/src/LLMStreamProcessor.test.ts`.                                               |           |      |

---

### Phase P3 — Context Window Manager (`@agentsy/context-manager`)

- **GOAL-P3**: Proactive token budget management that auto-compresses conversations before hitting provider limits.

| Task        | Description                                                                                                                                                                                                                                           | Completed | Date |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-P3-001 | Create `packages/context-manager/src/` with `index.ts`, `ContextManager.ts`, `compressConversation.ts`, `tokenBudget.ts`. Add `"@agentsy/core": "workspace:*"` and `"@agentsy/processor": "workspace:*"` to package deps.                            |           |      |
| TASK-P3-002 | Implement `TokenBudget`: tracks running input token count against model `contextWindow` from `ProviderCapability` matrix; exposes `remaining()`, `usedFraction()`, `willOverflow(tokens: number)`. Auto-compact skips active tool-call messages.      |           |      |
| TASK-P3-003 | Implement `compressConversation(messages, options)`: summarize oldest message window using a configured summarization prompt; return compressed messages array + `compressionStats`.                                                                  |           |      |
| TASK-P3-004 | Implement `ContextManager` class: wraps `TokenBudget`; auto-triggers `compressConversation()` when `usedFraction()` exceeds `autoCompactThreshold` (default 0.85); emits `ContextWindowWillOverflow` before compression, `ChatCompressed` after.     |           |      |
| TASK-P3-005 | Add `contextManager?: ContextManager` optional param to `AgentLoopOptions` in `packages/agent/src/types.ts`. Wire into `createAgentLoop.ts`: call `contextManager.check(messages)` before each step.                                                 |           |      |
| TASK-P3-006 | Write tests: overflow detection, compression trigger at threshold, post-compression message count reduction, `ChatCompressed` event emission, active-task skip.                                                                                       |           |      |

---

### Phase P4 — Cost Tracker (`@agentsy/cost-tracker`)

- **GOAL-P4**: Token cost accounting with budget enforcement — cost tracked at every tool loop iteration (Claude Code pattern).

| Task        | Description                                                                                                                                                                                                                                       | Completed | Date |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-P4-001 | Create `packages/cost-tracker/src/` with `index.ts`, `CostTracker.ts`, `pricingMap.ts`. Add `"@agentsy/core": "workspace:*"` to package deps.                                                                                                    |           |      |
| TASK-P4-002 | Implement `pricingMap.ts`: map of `NormalizerProvider` → `{ inputCostPer1kTokens, outputCostPer1kTokens }` for all 9 current providers + `openaiResponses`. Values in `PRICING` constant; overridable via config.                                |           |      |
| TASK-P4-003 | Implement `CostTracker`: accumulates `{ inputTokens, outputTokens, totalCostUsd }` per step and session; exposes `record(usage)`, `sessionTotal()`, `stepTotal()`, `reset()`.                                                                    |           |      |
| TASK-P4-004 | Add optional `budgetUsd?: number` to `CostTracker` constructor; emit `CostThresholdExceeded` event and throw `BudgetExceededError` when `sessionTotal().totalCostUsd` exceeds budget.                                                             |           |      |
| TASK-P4-005 | Add `costTracker?: CostTracker` optional param to `AgentLoopOptions`; wire into `createAgentLoop.ts` to call `costTracker.record(usage)` after each step.                                                                                        |           |      |
| TASK-P4-006 | Write tests for accumulation, budget enforcement, `CostThresholdExceeded` event, per-step reset.                                                                                                                                                 |           |      |

---

### Phase P5 — Parallel Tool Executor (in `@agentsy/runtime`)

- **GOAL-P5**: Safe concurrent tool execution with bounded parallelism and `areAllToolsComplete()` auto-continuation guard (tanstack/ai pattern).

| Task        | Description                                                                                                                                                                                                                                     | Completed | Date |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-P5-001 | Create `packages/runtime/src/tool-executor/` with `index.ts`, `ToolExecutor.ts`, `concurrencyPool.ts`. Add `"@agentsy/core": "workspace:*"` and `"@agentsy/agent": "workspace:*"` to `packages/runtime/package.json`.                          |           |      |
| TASK-P5-002 | Implement `ConcurrencyPool(maxConcurrent: number)`: token-bucket style pool; `acquire()` / `release()` with `AbortSignal` support; rejects immediately on abort.                                                                                |           |      |
| TASK-P5-003 | Implement `ToolExecutor`: accepts an array of `ToolCall` + an `ApprovalEngine` + a `ConcurrencyPool`; fans out execution; collects results in deterministic submission order; re-throws first error after all settle.                           |           |      |
| TASK-P5-004 | Add `areAllToolsComplete(toolCalls, results): boolean` predicate to `ToolExecutor`; used as auto-continuation guard in `createAgentLoop.ts` before deciding whether to do another loop iteration.                                               |           |      |
| TASK-P5-005 | Add `toolExecutor?: ToolExecutor` optional param to `AgentLoopOptions`; when present, replace sequential tool-call loop in `createAgentLoop.ts` with `toolExecutor.executeAll(toolCalls)`.                                                     |           |      |
| TASK-P5-006 | Write tests: sequential ordering guarantee, concurrency cap enforcement, abort cancels pending calls, first-error semantics, `areAllToolsComplete` guard.                                                                                       |           |      |

---

### Phase P6 — Tool Execution Runtime + Safety Controls (in `@agentsy/runtime`)

- **GOAL-P6**: The approval engine, sandbox modes, risk classifier, and `toolApproval` as loop-stop (not exception) — vercel/ai pattern: `ApprovalEngine` returns `ApprovalRequired` result, does NOT throw.

| Task        | Description                                                                                                                                                                                                                                                           | Completed | Date |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-P6-001 | Create `packages/runtime/src/approvals/` with `ApprovalEngine.ts`, `patterns.ts`, `ApprovalStore.ts`.                                                                                                                                                                |           |      |
| TASK-P6-002 | Implement `ApprovalEngine`: evaluates `ToolCall` against policy list; returns `ApprovalDecision` (`allow` / `ask` / `deny` / `plan`). Returns `{ type: 'ApprovalRequired', request }` result object — never throws — when interactive approval is needed.            |           |      |
| TASK-P6-003 | Implement `ApprovalStore`: persists `allow-always` decisions to `.agentsy/approvals.json`. `allow_patterns` entries take priority over `deny_patterns` (warning-first guardrails: prefer warning events to hard blocks). Issue a `PermissionWarning` event on first encounter of a new pattern before denying. |           |      |
| TASK-P6-004 | Create `packages/runtime/src/policy/RiskClassifier.ts`: assigns `RiskLevel` (`low` / `medium` / `high` / `critical`) to a `ToolCall` based on tool name pattern, destructive argument markers (`rm`, `DELETE`, `drop`, `overwrite`), and file-system path scope.     |           |      |
| TASK-P6-005 | Create `packages/runtime/src/sandbox/SandboxMode.ts` (`none` / `process` / `container`): `none` = direct exec; `process` = spawn with restricted env vars and no network; `container` = Docker exec (optional, requires Docker peer dep).                            |           |      |
| TASK-P6-006 | Wire `RiskClassifier` output into `ApprovalEngine`: `critical` risk always escalates to `ask` regardless of policy.                                                                                                                                                   |           |      |
| TASK-P6-007 | Add `approvalEngine`, `riskClassifier`, `sandboxMode` optional params to `AgentLoopOptions` in `packages/agent/src/types.ts`.                                                                                                                                         |           |      |
| TASK-P6-008 | Add `experimental_repairToolCall` hook to `AgentLoopOptions`: called when a tool call fails schema validation; receives the raw call and returns a repaired version or `null` to skip. Wire to `packages/core/src/structured/autoRepair.ts`.                         |           |      |
| TASK-P6-009 | Write tests for each risk level, pattern matching, policy override, `ApprovalRequired` result (not throw), `repairToolCall` hook invocation.                                                                                                                         |           |      |

---

### Phase R3 — API Surface Stabilization

- **GOAL-R3**: Freeze public contracts at v0.3.0-alpha across all packages to give downstream consumers a stable base.

| Task        | Description                                                                                                                                                              | Completed | Date |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ---- |
| TASK-R3-001 | Mark all public interfaces across all packages as `@public` JSDoc and all experimental interfaces as `@experimental`.                                                    |           |      |
| TASK-R3-002 | Run `turbo run typecheck` and resolve all TypeScript errors introduced by P0–P6 additions across all packages.                                                            |           |      |
| TASK-R3-003 | Bump all package versions to `0.3.0-alpha.0`. Publish all `@agentsy/*` packages to npm with `alpha` dist-tag using `turbo run build && pnpm -r publish --tag alpha`.    |           |      |

---

### Phase P7 — Session Persistence (`@agentsy/session`)

- **GOAL-P7**: Durable `StreamSnapshot` checkpoints enabling crash-safe resume. Atomic write + lazy session + early user-message persistence (Hermes Agent pattern).

| Task        | Description                                                                                                                                                                                                                                             | Completed | Date |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-P7-001 | Create `packages/session/src/` with `index.ts`, `SessionStore.ts`, `FileSystemSessionStore.ts`, `SessionResumeOptions.ts`. Add `"@agentsy/core": "workspace:*"` and `"@agentsy/processor": "workspace:*"` as deps.                                       |           |      |
| TASK-P7-002 | Define `SessionStore` interface: `save(sessionId, snapshot): Promise<void>`, `load(sessionId): Promise<StreamSnapshot \| null>`, `list(): Promise<string[]>`, `delete(sessionId): Promise<void>`.                                                        |           |      |
| TASK-P7-003 | Implement `FileSystemSessionStore`: atomic write (write to `.tmp` then `rename`) under `~/.agentsy/sessions/<sessionId>.json`. File-lock for concurrent access. **Lazy session**: create session file on first assistant message, NOT on loop start. **Early user-message persistence**: persist user message BEFORE starting LLM call (Hermes pattern for crash safety). |           |      |
| TASK-P7-004 | Add `sessionStore?: SessionStore` optional param to `AgentLoopOptions`; call `sessionStore.save(runId, snapshot)` after each step in `createAgentLoop.ts`.                                                                                               |           |      |
| TASK-P7-005 | Implement `resumeSession(sessionId, options)` factory: loads snapshot, reconstructs messages array, returns pre-initialized `AgentLoopHandle` ready to `run()`.                                                                                          |           |      |
| TASK-P7-006 | Extend `packages/core/src/recovery/index.ts` `captureStreamState` to accept optional `sessionStore` and auto-persist when provided.                                                                                                                      |           |      |
| TASK-P7-007 | Write tests: round-trip save/load, atomic write crash simulation, lazy session creation timing, early user-message persistence ordering, resume reconstructs correct message history.                                                                     |           |      |

---

### Phase P8 — MCP Orchestration (`@agentsy/mcp`)

- **GOAL-P8**: First-class MCP 2025-06-18 compliant server lifecycle management with WebSocket idle timeout (ACP reference pattern).

| Task        | Description                                                                                                                                                                                                                                               | Completed | Date |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-P8-001 | Create `packages/mcp/src/` with `index.ts`, `MCPOrchestrator.ts`, `MCPServerConfig.ts`, `MCPTrustLevel.ts`, `MCPCapabilityNegotiator.ts`. Add `"@agentsy/core": "workspace:*"` and `"@agentsy/runtime": "workspace:*"` as deps. Add `@modelcontextprotocol/sdk` as peer dep. |           |      |
| TASK-P8-002 | Define `MCPServerConfig`: `{ id, command, args, env, trustLevel: 'trusted' \| 'untrusted' \| 'readonly', autoStart: boolean, restartOnCrash: boolean, timeout: number, idleTimeoutMs?: number }`. Add `idleTimeoutMs` for WebSocket connection idle timeout. |           |      |
| TASK-P8-003 | Implement `MCPOrchestrator`: manages registry of `MCPServerConfig`s; `start(id)`, `stop(id)`, `restart(id)`, `listTools(id)`, `callTool(id, name, args, signal)` methods. Implement WebSocket idle timeout: disconnect after `idleTimeoutMs` of no tool calls; reconnect on next call. Emits `MCPServerStarted`, `MCPServerStopped`, `MCPServerCrashed` events. |           |      |
| TASK-P8-004 | Implement `MCPCapabilityNegotiator`: handshakes per MCP 2025-06-18 spec; caches `ServerCapabilities`; re-negotiates on reconnect.                                                                                                                        |           |      |
| TASK-P8-005 | Enforce trust-level filtering in `MCPOrchestrator.callTool`: `readonly` servers blocked from `write`/`exec` annotation tools; `untrusted` servers always go through `ApprovalEngine`.                                                                    |           |      |
| TASK-P8-006 | Add `mcpOrchestrator?: MCPOrchestrator` optional param to `AgentLoopOptions`; auto-discover and merge MCP tools into agent's tool registry at loop start.                                                                                                |           |      |
| TASK-P8-007 | Write tests: server lifecycle, capability negotiation, trust-level rejection, tool call dispatch, idle timeout reconnect.                                                                                                                                 |           |      |

---

### Phase P9 — Provider Strategy + Routing (`@agentsy/providers`)

- **GOAL-P9**: Multi-provider capability matrix with configurable fallback chains.

| Task        | Description                                                                                                                                                                                                                    | Completed | Date |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ---- |
| TASK-P9-001 | Create `packages/providers/src/` with `index.ts`, `ProviderRegistry.ts`, `CapabilityMatrix.ts`, `FallbackChain.ts`. Add `"@agentsy/core": "workspace:*"` and `"@agentsy/normalizers": "workspace:*"` as deps.                 |           |      |
| TASK-P9-002 | Populate `CapabilityMatrix` for all 9 providers (8 existing + `openaiResponses`) with `contextWindow`, `supportsVision`, `supportsTools`, `supportsStreaming`, `inputCostPer1kTokens`, `outputCostPer1kTokens`.                |           |      |
| TASK-P9-003 | Implement `FallbackChain`: ordered provider list; `next(currentProvider)` returns next; supports `CostThresholdExceeded` and `ContextWindowWillOverflow` as automatic fallback triggers.                                       |           |      |
| TASK-P9-004 | Implement `ProviderRegistry`: holds active `FallbackChain` + `CapabilityMatrix`; `selectProvider(requirements)` returns best matching provider.                                                                               |           |      |
| TASK-P9-005 | Wire `ProviderRegistry` into `packages/processor/src/pipeline/createPipeline.ts`: when `providerRegistry` is in `PipelineOptions`, auto-select provider before creating normalizer.                                           |           |      |
| TASK-P9-006 | Write tests: capability filtering, fallback on overflow, fallback on cost limit, cost accounting integration.                                                                                                                  |           |      |

---

### Phase X1 — Extensibility Contracts (in `@agentsy/runtime` and `@agentsy/core`)

- **GOAL-X1**: Define all extensibility interfaces; add tool interface predicates for `readOnly`, `destructive`, `requiresApproval` (tanstack/ai `ToolDefinition` annotation pattern).

| Task        | Description                                                                                                                                                                                                                                                                 | Completed | Date |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-X1-001 | In `packages/runtime/src/hooks/types.ts`: `HookRegistry` interface, `HookHandler<T>` type, `HookDispatcher` interface with `dispatch(event): Promise<HookResult>` and `register(eventType, handler)`.                                                                       |           |      |
| TASK-X1-002 | In `packages/runtime/src/skills/types.ts`: `SkillManifest` (re-export from `@agentsy/core`), `SkillLoader` interface, `SkillRegistry` interface.                                                                                                                            |           |      |
| TASK-X1-003 | In `packages/runtime/src/plugins/types.ts`: `PluginManifest` (re-export from `@agentsy/core`), `PluginLoader` interface, `PluginRuntime` interface.                                                                                                                         |           |      |
| TASK-X1-004 | In `packages/core/src/types/tools.ts`: extend `ToolDefinition` with `annotations?: { readOnly?: boolean, destructive?: boolean, requiresApproval?: boolean, idempotent?: boolean }`. These annotations feed the `RiskClassifier` in Phase P6 as a declarative risk signal. |           |      |
| TASK-X1-005 | Add `./hooks`, `./skills`, `./plugins` stub subpath exports from `@agentsy/runtime` barrel (types files) so consumers can import types before implementations land.                                                                                                         |           |      |

---

### Phase X2 — Hook Runtime Engine (in `@agentsy/runtime`)

- **GOAL-X2**: The lifecycle dispatch engine.

| Task        | Description                                                                                                                                                                                                     | Completed | Date |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-X2-001 | Create `packages/runtime/src/hooks/HookDispatcher.ts`: ordered handler registry per event type; `dispatch(event, context)` awaits handlers in registration order; first `deny` result short-circuits remaining handlers. |           |      |
| TASK-X2-002 | Implement audit trail: every dispatch appends `{ eventType, decision, handlerName, timestamp }` to in-memory audit log; expose `getAuditLog()` and `clearAuditLog()`.                                            |           |      |
| TASK-X2-003 | Wire `HookDispatcher` into `packages/agent/src/createAgentLoop.ts`: dispatch `beforeStep` / `afterStep` / `beforeToolCall` / `afterToolCall` / `onError` / `onAbort`.                                           |           |      |
| TASK-X2-004 | Add `hookDispatcher?: HookDispatcher` to `AgentLoopOptions`.                                                                                                                                                    |           |      |
| TASK-X2-005 | Write tests: handler ordering, short-circuit on deny, audit log correctness, async handler timeout.                                                                                                             |           |      |

---

### Phase X3 — Skill System (in `@agentsy/runtime`)

- **GOAL-X3**: Agent Skills open standard compatibility.

| Task        | Description                                                                                                                                                                                                                   | Completed | Date |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-X3-001 | Implement `packages/runtime/src/skills/SkillLoader.ts`: scans `~/.agents/skills/` and `.agents/skills/`; parses `SKILL.md` frontmatter (name, description, triggers, schema); returns `SkillManifest[]`.                     |           |      |
| TASK-X3-002 | Implement `packages/runtime/src/skills/SkillRegistry.ts`: in-memory registry; `register(manifest)`, `lookup(trigger): SkillManifest[]`, `list(): SkillManifest[]`.                                                           |           |      |
| TASK-X3-003 | Implement `packages/runtime/src/skills/SkillExecutor.ts`: `execute(manifest, context)` injects full `SKILL.md` as `<skill_context>` XML tag into system prompt via `splitLeadingXmlContext` from `@agentsy/core`.             |           |      |
| TASK-X3-004 | Add `skillRegistry?: SkillRegistry` to `AgentLoopOptions`; at loop start, scan and register skills from configured paths.                                                                                                    |           |      |
| TASK-X3-005 | Write tests: skill discovery from two-directory scan, frontmatter parsing, trigger lookup, `<skill_context>` injection.                                                                                                      |           |      |

---

### Phase X4 — Plugin Runtime (in `@agentsy/runtime`)

- **GOAL-X4**: Claude plugin manifest compatibility subset — signed checksums, trust isolation.

| Task        | Description                                                                                                                                                                                                                 | Completed | Date |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-X4-001 | Implement `packages/runtime/src/plugins/PluginLoader.ts`: loads `PluginManifest` from local path or npm package; verifies `checksum` (SHA-256 HMAC, key = `pluginSigningKey` config) before executing entrypoint.           |           |      |
| TASK-X4-002 | Implement `packages/runtime/src/plugins/PluginRuntime.ts`: calls loaded plugin's exported `register(context)` function; collects returned `ToolDefinition[]` and `HookRegistration[]`; enforces no built-in tool override.  |           |      |
| TASK-X4-003 | Add `plugins?: PluginManifest[]` to `AgentLoopOptions`; load and register all plugins at loop initialization.                                                                                                               |           |      |
| TASK-X4-004 | Write tests: checksum verification pass/fail, plugin tool registration, built-in tool override rejection.                                                                                                                   |           |      |

---

### Phase P10 — Multi-Agent Orchestration (in `@agentsy/agent`)

- **GOAL-P10**: Parent→child subagent spawning with depth caps.

| Task         | Description                                                                                                                                                                                                                                              | Completed | Date |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-P10-001 | Create `packages/agent/src/SubagentRunner.ts`: spawns child `createAgentLoop` with copy of parent options minus `memoryEngine` (child uses same wiki read but separate session); `run(task, options?): Promise<StepResult>`.                            |           |      |
| TASK-P10-002 | Add `maxSubagentDepth?: number` (default: 3) to `AgentLoopOptions`; pass `_depth` counter through subagent options; throw `MaxDepthExceededError` at limit.                                                                                             |           |      |
| TASK-P10-003 | Implement `SubagentCoordinator` in `packages/agent/src/SubagentCoordinator.ts`: manages pool of `SubagentRunner` instances; `spawnParallel(tasks): Promise<StepResult[]>` with concurrency bounded by `toolExecutor.concurrencyPool`.                   |           |      |
| TASK-P10-004 | Add `subagentCoordinator?: SubagentCoordinator` to `AgentLoopOptions`.                                                                                                                                                                                   |           |      |
| TASK-P10-005 | Write tests: sequential subagent, parallel subagents, depth cap enforcement, parent abort propagates to children.                                                                                                                                        |           |      |

---

### Phase P11 — Observability (`@agentsy/telemetry`)

- **GOAL-P11**: Structured logging, OpenTelemetry spans, audit trail, health checks. Load OTel lazily (Gemini CLI + Claude Code pattern).

| Task         | Description                                                                                                                                                                                                                                | Completed | Date |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ---- |
| TASK-P11-001 | Create `packages/telemetry/src/` with `index.ts`, `spans.ts`, `structuredLogger.ts`, `healthCheck.ts`. Add `"@agentsy/core": "workspace:*"` as dep. Add `@opentelemetry/api` as optional peer dep.                                        |           |      |
| TASK-P11-002 | Implement `structuredLogger.ts`: JSON-structured emitter (`info`, `warn`, `error`, `debug`); redacts secrets via regex patterns from SEC-003; writes to stderr; accepts optional `WritableStream`.                                         |           |      |
| TASK-P11-003 | Implement `spans.ts`: wraps `@opentelemetry/api` behind dynamic `import()` guard; no-ops when OTel not installed. Exposes `startSpan(name, attrs)`, `endSpan(span, status)`, `recordException(span, error)`.                              |           |      |
| TASK-P11-004 | Add OTel span instrumentation (via dynamic import) to: `createAgentLoop` (loop span in `@agentsy/agent`), `ToolExecutor.executeAll` (per-tool span in `@agentsy/runtime`), `MCPOrchestrator.callTool` (MCP span in `@agentsy/mcp`).       |           |      |
| TASK-P11-005 | Implement `healthCheck.ts`: `checkHealth(options): Promise<HealthStatus>` — verifies provider connectivity, MCP server reachability, session store writability, vector store connectivity.                                                 |           |      |
| TASK-P11-006 | Write tests for structured log redaction and health check status aggregation. Verify OTel no-ops when package not installed.                                                                                                               |           |      |

---

### Phase X5 — Native Memory Engine (`@agentsy/memory`)

- **GOAL-X5**: The 3-layer blended memory system. Nanobot Dream lifecycle architecture: the compiled wiki is a maintained artifact, NOT a retrieval index.

| Task        | Description                                                                                                                                                                                                                                                           | Completed | Date |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-X5-001 | Create `packages/memory/src/` with `index.ts`, `store.ts`, `RawEventLog.ts`, `WikiStore.ts`, `MemoryLifecycle.ts`, `WikiLinter.ts`. Add `"@agentsy/core": "workspace:*"` and `"@agentsy/retrieval": "workspace:*"` as deps.                                           |           |      |
| TASK-X5-002 | Define interfaces in `store.ts`: `MemoryStore`, `MemoryRetriever`, `MemoryFeedback`, `MemoryMaintenance` (re-export from `@agentsy/core` types).                                                                                                                      |           |      |
| TASK-X5-003 | Implement `RawEventLog`: append-only JSONL file at `~/.agentsy/memory/raw/sessions/<sessionId>.jsonl`; `append(snapshot)`, `readAll(sessionId)`, `list()`.                                                                                                            |           |      |
| TASK-X5-004 | Implement `WikiStore`: manages `~/.agentsy/memory/wiki/` directory tree (`entities/`, `concepts/`, `sources/`, `synthesis/`); `writePage`, `readPage`, `deletePage`, `listPages`, `appendToLog`, `updateIndex`. File-level advisory locking via `proper-lockfile` peer dep to prevent concurrent write corruption. |           |      |
| TASK-X5-005 | Write `schema/AGENT.md` template: LLM-facing wiki page structural conventions — frontmatter fields (`id`, `category`, `created`, `updated`, `citations`, `confidence`), heading conventions, citation format. Nanobot Dream lifecycle alignment: `dream` = wiki synthesis. |           |      |
| TASK-X5-006 | Implement `MemoryLifecycle` (memelord + nanobot Dream pattern): `startTask(taskDescription)` → vector-searches wiki → returns relevant pages as `<memory_context>` XML; `report(insight)` → appends to session observations; `endTask(feedback)` → scores feedback, triggers wiki synthesis LLM call, updates wiki pages; `contradict(pageId, replacement)` → deletes old page, writes replacement, queues re-embedding. |           |      |
| TASK-X5-007 | Implement `WikiLinter`: `lint()` scans for (a) contradictions, (b) orphan pages, (c) stale pages (confidence < 0.3, last-updated > 30 days). Returns `LintResult[]`. Exposes as `memory_lint()` tool.                                                                |           |      |
| TASK-X5-008 | Implement `decay()`: reduces confidence of wiki pages not cited in last N sessions (configurable `decayWindow`, default 10); GCs pages below `gcThreshold` (default 0.1).                                                                                             |           |      |
| TASK-X5-009 | Add `memoryEngine?: MemoryLifecycle` to `AgentLoopOptions`; call `startTask` / `endTask` at agent loop boundaries in `createAgentLoop.ts`.                                                                                                                            |           |      |
| TASK-X5-010 | Write tests: raw event log append/read, wiki CRUD, lifecycle startTask/endTask, contradiction resolution, linter detection, decay below threshold.                                                                                                                    |           |      |

---

### Phase X6 — Vector RAG Backend (`@agentsy/retrieval`)

- **GOAL-X6**: Layer 2 of the memory stack. libSQL/Turso `vector32` backend; `ChunkStrategy` interface (tanstack/ai pattern); OpenBrain-compatible tool surface.

| Task        | Description                                                                                                                                                                                                                                                                                   | Completed | Date |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-X6-001 | Create `packages/retrieval/src/` with `index.ts`, `VectorStore.ts`, `LibSQLVectorStore.ts`, `ChunkStrategy.ts`, `embeddings/`. Add `@libsql/client` as optional peer dep.                                                                                                                     |           |      |
| TASK-X6-002 | Define `VectorStore` interface: `upsert(id, vector, metadata)`, `search(vector, topK, filter?): Promise<VectorResult[]>`, `delete(id)`, `count()`.                                                                                                                                            |           |      |
| TASK-X6-003 | Implement `LibSQLVectorStore`: connects to `~/.agentsy/memory/vector.db`; creates `wiki_embeddings` table with `vector32`; implements `VectorStore`. Graceful fallback when libSQL not installed.                                                                                              |           |      |
| TASK-X6-004 | Implement `ChunkStrategy` interface with two implementations: `ImmediateStrategy` (chunk on every write) and `WordBoundaryStrategy` (accumulate until word boundary, configurable window). `ChunkStrategy` applies configurable `chunkSize` (default 512 tokens) and `overlap` (default 64 tokens). |           |      |
| TASK-X6-005 | Create `packages/retrieval/src/embeddings/` with `EmbeddingProvider.ts` interface (`embed(texts): Promise<number[][]>`), `OpenAIEmbeddingProvider.ts`, `LocalEmbeddingProvider.ts`.                                                                                                            |           |      |
| TASK-X6-006 | Implement wiki indexer: on `WikiStore.writePage()`, auto-chunk page, embed, upsert vectors. On `WikiStore.deletePage()`, delete all chunk vectors for that page.                                                                                                                               |           |      |
| TASK-X6-007 | Implement OpenBrain tool surface: `memory_search(query, opts)`, `memory_capture(insight)`, `memory_list(category?, filter?)`, `memory_stats()`, `memory_lint()`. Export from `packages/retrieval/src/tools.ts`.                                                                               |           |      |
| TASK-X6-008 | Wire retrieval context injection: `memory_search` results formatted as `<memory_context id="{pageId}" score="{score}">...</memory_context>` tags fed through `splitLeadingXmlContext` → `dedupeXmlContext` → `stripXmlContextTags` pipeline from `@agentsy/core`. Apply `enforcePrivacyTags: true`. |           |      |
| TASK-X6-009 | Add SEC-009 injection detection: scan retrieved chunk content for instruction-override patterns before injection; emit `MemoryInjectionSuspected` and drop chunk if detected.                                                                                                                  |           |      |
| TASK-X6-010 | Write tests: chunk strategy (both implementations), vector upsert/search, `memory_search` tool result format, `MemoryInjectionSuspected` detection.                                                                                                                                           |           |      |

---

### Phase X7 — Remote Memory Backend Switch (in `@agentsy/retrieval`)

- **GOAL-X7**: Allow swapping local libSQL for remote Turso via config — zero code change for consumers.

| Task        | Description                                                                                                                                                                                          | Completed | Date |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-X7-001 | Implement `TursoVectorStore` in `packages/retrieval/src/TursoVectorStore.ts`: same `VectorStore` interface, uses remote Turso URL + auth token from config.                                           |           |      |
| TASK-X7-002 | Add `vectorStoreUrl?: string` and `vectorStoreAuthToken?: string` to `MemoryLifecycle` options; auto-select `TursoVectorStore` vs `LibSQLVectorStore` based on URL scheme.                            |           |      |
| TASK-X7-003 | Document the local→remote switch in `docs/developer-guide.md`.                                                                                                                                      |           |      |
| TASK-X7-004 | Write tests: backend selection logic, Turso connection URL parsing.                                                                                                                                 |           |      |

---

### Phase R4 — Downstream App Handoff Readiness

- **GOAL-R4**: Produce a starter spec and integration guide for downstream consumer projects.

| Task        | Description                                                                                                                                                                                                          | Completed | Date |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-R4-001 | Create `docs/downstream-app-starter.md`: describes building a CLI app on top of `@agentsy/agent` + other packages; `createAgentLoop` setup, provider config, tool registration, memory engine wiring, MCP config.   |           |      |
| TASK-R4-002 | Create `examples/minimal-agent/` with a 50-line `index.ts`: minimal agent, one tool, console streaming output. Show selective `@agentsy/*` imports.                                                                  |           |      |
| TASK-R4-003 | Ensure all `@public` API surface has TSDoc comments consumable by downstream projects.                                                                                                                              |           |      |

---

### Phase X8 — Compliance + Acceptance Matrix

- **GOAL-X8**: Verify conformance to all relevant open standards and performance SLOs before release.

| Task        | Description                                                                                                                                                                                                                           | Completed | Date |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-X8-001 | Agent Skills conformance: verify `SkillLoader` in `@agentsy/runtime` correctly parses all frontmatter fields; run against 5 sample skills from agentskills.io Skills Hub.                                                             |           |      |
| TASK-X8-002 | MCP 2025-06-18 conformance: run official MCP conformance test suite against `@agentsy/mcp` `MCPOrchestrator`.                                                                                                                         |           |      |
| TASK-X8-003 | AG-UI protocol conformance: verify `@agentsy/ag-ui` adapters emit complete `RUN_STARTED`→`MESSAGES_SNAPSHOT`→`RUN_FINISHED` envelope per AG-UI spec; test `TOOL_CALL_END` dual-role (args-done vs args-done+result).                  |           |      |
| TASK-X8-004 | Claude plugin subset conformance: verify `@agentsy/runtime` `PluginLoader` accepts manifests from 3 published Claude plugins (tools subset only).                                                                                    |           |      |
| TASK-X8-005 | Security suite: prompt injection corpus against SEC-009 detection; SEC-002 path confinement rejects 20 traversal patterns; SEC-003 redaction strips 15 secret patterns.                                                              |           |      |
| TASK-X8-006 | Performance suite: startup latency (p50/p95), first-token latency (warm provider), streaming repaint budget, memory ceiling (30-min session), memory retrieval latency. Assert against SLOs in Section 7.                            |           |      |

---

### Phase P12 — QA Hardening + Launch

- **GOAL-P12**: Production-ready release with full E2E matrix, adversarial tests, and three-channel release publishing.

| Task         | Description                                                                                                                                                                                                                                                | Completed | Date |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-P12-001 | Write E2E integration tests covering: full agent loop (3 steps, 2 tool calls), session resume after simulated crash, MCP tool invocation, memory search injection, wiki synthesis pass. Place in `packages/agent/src/agent.e2e.test.ts`.                   |           |      |
| TASK-P12-002 | Write adversarial test corpus: malformed JSON tool args, truncated SSE stream, oversized context (>200K tokens), wiki page with injection payload, plugin with invalid checksum.                                                                           |           |      |
| TASK-P12-003 | Add performance benchmarks to per-package `perf/` directories mirroring Gemini CLI's test structure.                                                                                                                                                      |           |      |
| TASK-P12-004 | Publish all `@agentsy/*` packages at `v0.3.0` to npm `latest` channel. Publish `@agentsy/*@0.3.0-nightly` nightly builds via CI cron. Tag `v0.3.0` in git. Create GitHub release with `CHANGELOG.md` entry. Three release channels: `latest`, `alpha`, `nightly`. |           |      |
| TASK-P12-005 | Publish `@selfagency/llm-stream-parser@0.3.0` shim to npm with `deprecated` notice pointing to `@agentsy/*` migration guide.                                                                                                                              |           |      |

---

## 3. Alternatives

- **ALT-001**: Single package `@agentsy/agentsy` instead of monorepo. Rejected: violates REQ-021 (independent installability); consumers who only use stream parsing must not pull in memory, MCP, etc.
- **ALT-002**: Use Nx instead of Turborepo. Rejected: Turbo is simpler for this repo size; Nx adds generator and executor complexity not needed here; Turbo's pnpm workspace integration is lighter.
- **ALT-003**: Use npm workspaces instead of pnpm workspaces. Rejected: pnpm workspaces are already in use; pnpm's strict `node_modules` isolation prevents accidental cross-package imports; `workspace:*` protocol is idiomatic pnpm.
- **ALT-004**: Use a flat `packages/` layout without a `@agentsy/tsconfig` shared config. Rejected: shared tsconfig prevents tsconfig drift across 16 packages; single source of truth for strict settings.
- **ALT-005**: Keep `src/` at repo root and use pnpm workspace aliases to re-export. Rejected: this is not a real monorepo; it defeats independent publish/versioning and Turbo's cache granularity.
- **ALT-006**: Use raw SQLite FTS5 instead of libSQL vector32 for memory retrieval. Rejected: FTS5 is keyword-based; libSQL is a drop-in superset of SQLite with vector support.
- **ALT-007**: Embed wiki compilation inside the vector store (auto-summarize on upsert). Rejected: wiki compilation is an LLM judgment task, not a mechanical chunking step (Karpathy invariant).
- **ALT-008**: Use a separate process for the MCP orchestrator (sidecar pattern). Rejected: adds deployment complexity inappropriate for a library.
- **ALT-009**: Use Rush instead of Turborepo. Rejected: Rush's `rush.json` config complexity and Microsoft ecosystem focus are not a good fit for a pnpm-native TypeScript library.

---

## 4. Dependencies

- **DEP-001**: `turbo` — Turborepo build orchestrator. Root devDependency. Required for Phase MONO-0.
- **DEP-002**: `@libsql/client` — libSQL/Turso client for `@agentsy/retrieval` Layer 2. Optional peer dependency.
- **DEP-003**: `@opentelemetry/api` — OTel tracing API for `@agentsy/telemetry`. Optional peer dependency; loaded via dynamic import.
- **DEP-004**: `@modelcontextprotocol/sdk` — MCP SDK for `@agentsy/mcp` MCP 2025-06-18 lifecycle. Peer dependency of `@agentsy/mcp`. Confirm version supports 2025-06-18 spec.
- **DEP-005**: `saxophone` — SAX-based streaming XML parser. Already a runtime dep in `@agentsy/core`. Used by `XmlStreamFilter`.
- **DEP-006**: `zod` — schema validation. Already used in normalizers. Confirm v4.
- **DEP-007**: `proper-lockfile` — advisory file locking for `WikiStore.writePage()` in `@agentsy/memory`. Optional peer dep.
- **DEP-008**: Embedding provider at runtime (OpenAI API, local model, etc.) — not a package dep; resolved via `EmbeddingProvider` interface in `@agentsy/retrieval`.
- **DEP-009**: Docker — optional, only for `SandboxMode.container` in `@agentsy/runtime`. Not a package dep.
- **DEP-010**: `@agentsy/tsconfig` — shared TypeScript configuration. Internal workspace package, devDependency of all other packages.

---

## 5. Files

### Monorepo Root Files (new/modified)

- **FILE-ROOT-001**: `turbo.json` — Turborepo pipeline config (tasks: build, typecheck, test, lint, format).
- **FILE-ROOT-002**: `pnpm-workspace.yaml` — updated: `packages: ["packages/*"]`.
- **FILE-ROOT-003**: `package.json` — root workspace package; add `turbo` devDep; add `turbo run *` scripts; add `workspaces` field.
- **FILE-ROOT-004**: `tsconfig.json` — root TypeScript project references pointing to all 16 packages.
- **FILE-ROOT-005**: `Taskfile.yaml` — add `mono:build`, `mono:test`, `mono:typecheck`, `mono:lint` tasks.
- **FILE-ROOT-006**: `.github/workflows/release.yml`, `tests.yml` — update to use `turbo run` commands; add `TURBO_TOKEN`/`TURBO_TEAM` env scaffolding.

### New Package Structure

- **FILE-PKG-001**: `packages/tsconfig/` — `package.json` (`@agentsy/tsconfig`), `base.json`, `library.json`.
- **FILE-PKG-002**: `packages/core/` — `@agentsy/core`: xml-filter, sse, thinking, tool-calls, context, formatting, markdown, structured, recovery, types, vendor, ui.
- **FILE-PKG-003**: `packages/normalizers/` — `@agentsy/normalizers`: all 9 LLM provider normalizers.
- **FILE-PKG-004**: `packages/processor/` — `@agentsy/processor`: `LLMStreamProcessor`, `AccumulatedMessage`, `ProcessorStats`, `pipeline/`.
- **FILE-PKG-005**: `packages/agent/` — `@agentsy/agent`: `createAgentLoop`, `stopConditions`, `SubagentRunner`, `SubagentCoordinator`, agent types.
- **FILE-PKG-006**: `packages/adapters/` — `@agentsy/adapters`: `generic.ts`, `vscode.ts`.
- **FILE-PKG-007**: `packages/ag-ui/` — `@agentsy/ag-ui`: full existing `src/ag-ui/` module.
- **FILE-PKG-008**: `packages/runtime/` — `@agentsy/runtime`: `tool-executor/`, `approvals/`, `policy/`, `sandbox/`, `hooks/`, `skills/`, `plugins/`.
- **FILE-PKG-009**: `packages/context-manager/` — `@agentsy/context-manager`: `ContextManager`, `compressConversation`, `tokenBudget`.
- **FILE-PKG-010**: `packages/cost-tracker/` — `@agentsy/cost-tracker`: `CostTracker`, `pricingMap`.
- **FILE-PKG-011**: `packages/session/` — `@agentsy/session`: `SessionStore`, `FileSystemSessionStore`, `resumeSession`.
- **FILE-PKG-012**: `packages/mcp/` — `@agentsy/mcp`: `MCPOrchestrator`, `MCPCapabilityNegotiator`, `MCPServerConfig`.
- **FILE-PKG-013**: `packages/providers/` — `@agentsy/providers`: `ProviderRegistry`, `CapabilityMatrix`, `FallbackChain`.
- **FILE-PKG-014**: `packages/memory/` — `@agentsy/memory`: `RawEventLog`, `WikiStore`, `MemoryLifecycle`, `WikiLinter`.
- **FILE-PKG-015**: `packages/retrieval/` — `@agentsy/retrieval`: `VectorStore`, `LibSQLVectorStore`, `TursoVectorStore`, `ChunkStrategy`, `embeddings/`, `tools.ts`.
- **FILE-PKG-016**: `packages/telemetry/` — `@agentsy/telemetry`: `spans`, `structuredLogger`, `healthCheck`.
- **FILE-PKG-017**: `packages/shim/` — `@selfagency/llm-stream-parser`: compatibility re-export barrel + deprecated package.json.

### Per-Package Config Files (×16 packages)

Each package in `packages/<domain>/` contains:
- `package.json` — name, version, deps, scripts, publishConfig, exports map
- `tsconfig.json` — extends `@agentsy/tsconfig/library.json`
- `tsup.config.ts` — dual ESM/CJS, externals list, `.d.ts`
- `vitest.config.ts` — extends root vitest config
- `README.md` — package-specific docs

### New Source Files (within packages)

- **FILE-SRC-001**: `packages/core/src/types/` — `events.ts`, `hooks.ts`, `memory.ts`, `skills.ts`, `plugins.ts`, `providers.ts`, `approval.ts`, `tools.ts`, `index.ts`
- **FILE-SRC-002**: `packages/agent/src/stopConditions.ts` — `isStepCount`, `hasToolCall`, `isLoopFinished`, `maxIterations`, `untilFinishReason`, `combineStrategies` (vercel/ai + tanstack/ai patterns)
- **FILE-SRC-003**: `packages/agent/src/SubagentRunner.ts`, `packages/agent/src/SubagentCoordinator.ts`
- **FILE-SRC-004**: `packages/runtime/src/tool-executor/` — `ToolExecutor.ts`, `concurrencyPool.ts`
- **FILE-SRC-005**: `packages/runtime/src/approvals/` — `ApprovalEngine.ts`, `patterns.ts`, `ApprovalStore.ts`
- **FILE-SRC-006**: `packages/runtime/src/policy/RiskClassifier.ts`
- **FILE-SRC-007**: `packages/runtime/src/sandbox/SandboxMode.ts`
- **FILE-SRC-008**: `packages/runtime/src/hooks/HookDispatcher.ts`
- **FILE-SRC-009**: `packages/runtime/src/skills/` — `SkillLoader.ts`, `SkillRegistry.ts`, `SkillExecutor.ts`
- **FILE-SRC-010**: `packages/runtime/src/plugins/` — `PluginLoader.ts`, `PluginRuntime.ts`
- **FILE-SRC-011**: `packages/context-manager/src/` — `ContextManager.ts`, `compressConversation.ts`, `tokenBudget.ts`
- **FILE-SRC-012**: `packages/cost-tracker/src/` — `CostTracker.ts`, `pricingMap.ts`
- **FILE-SRC-013**: `packages/session/src/` — `SessionStore.ts`, `FileSystemSessionStore.ts`, `SessionResumeOptions.ts`
- **FILE-SRC-014**: `packages/mcp/src/` — `MCPOrchestrator.ts`, `MCPServerConfig.ts`, `MCPTrustLevel.ts`, `MCPCapabilityNegotiator.ts`
- **FILE-SRC-015**: `packages/providers/src/` — `ProviderRegistry.ts`, `CapabilityMatrix.ts`, `FallbackChain.ts`
- **FILE-SRC-016**: `packages/memory/src/` — `RawEventLog.ts`, `WikiStore.ts`, `MemoryLifecycle.ts`, `WikiLinter.ts`
- **FILE-SRC-017**: `packages/retrieval/src/` — `VectorStore.ts`, `LibSQLVectorStore.ts`, `TursoVectorStore.ts`, `ChunkStrategy.ts`, `embeddings/EmbeddingProvider.ts`, `embeddings/OpenAIEmbeddingProvider.ts`, `tools.ts`
- **FILE-SRC-018**: `packages/telemetry/src/` — `spans.ts`, `structuredLogger.ts`, `healthCheck.ts`
- **FILE-SRC-019**: `schema/AGENT.md` — LLM-facing wiki structural conventions (nanobot Dream template)
- **FILE-SRC-020**: `examples/minimal-agent/index.ts` — 50-line minimal agent example

### New Documentation Files

- **FILE-DOC-001**: `docs/architecture.md` — Mermaid package dependency graph + layer separation description
- **FILE-DOC-002**: `docs/packages.md` — reference table of all 15 `@agentsy/*` packages
- **FILE-DOC-003**: `docs/migration.md` — `@selfagency/llm-stream-parser` → `@agentsy/*` migration guide
- **FILE-DOC-004**: `docs/downstream-app-starter.md` — consumer project starter guide
- **FILE-DOC-005**: `packages/shim/README.md` — shim migration guide with import path mapping

---

## 6. Testing

- **TEST-001**: `packages/core/src/types/types.test.ts` — discriminated union narrowing for all new type unions.
- **TEST-002**: `packages/processor/src/LLMStreamProcessor.test.ts` — 6 new events, per-message state Map, lazy UIMessage creation, `replay()` round-trip.
- **TEST-003**: `packages/context-manager/src/contextManager.test.ts` — overflow detection, auto-compact trigger, active-task skip, `ChatCompressed` event.
- **TEST-004**: `packages/cost-tracker/src/costTracker.test.ts` — token accumulation, USD calculation, budget enforcement, per-step reset.
- **TEST-005**: `packages/runtime/src/tool-executor/toolExecutor.test.ts` — sequential ordering, cap enforcement, abort propagation, `areAllToolsComplete` guard.
- **TEST-006**: `packages/runtime/src/approvals/approvalEngine.test.ts` — all 5 `ApprovalMode` values including `plan`, `ApprovalRequired` result (not throw), `allow_patterns` priority, `repairToolCall` hook.
- **TEST-007**: `packages/runtime/src/policy/riskClassifier.test.ts` — `critical` escalation, `low` for read-only, path confinement rejection.
- **TEST-008**: `packages/runtime/src/hooks/hookDispatcher.test.ts` — handler ordering, `deny` short-circuit, audit log, async timeout.
- **TEST-009**: `packages/runtime/src/skills/skills.test.ts` — two-directory scan, frontmatter parsing, trigger lookup, `<skill_context>` injection.
- **TEST-010**: `packages/runtime/src/plugins/plugins.test.ts` — checksum pass/fail, tool registration, override rejection.
- **TEST-011**: `packages/session/src/session.test.ts` — save/load round-trip, atomic write crash simulation, lazy creation timing, early user-message persistence ordering, resume history reconstruction.
- **TEST-012**: `packages/mcp/src/mcp.test.ts` — server lifecycle, capability negotiation, trust-level rejection, tool dispatch, idle timeout reconnect.
- **TEST-013**: `packages/providers/src/providers.test.ts` — capability filtering, fallback on overflow event, fallback on cost limit.
- **TEST-014**: `packages/memory/src/memory.test.ts` — raw log append/read, wiki CRUD with file locking, lifecycle startTask/endTask, contradiction resolution, linter (contradiction, orphan, stale), decay below threshold.
- **TEST-015**: `packages/retrieval/src/retrieval.test.ts` — `ImmediateStrategy` vs `WordBoundaryStrategy`, vector upsert/search, `memory_search` result format, `MemoryInjectionSuspected` detection.
- **TEST-016**: `packages/telemetry/src/telemetry.test.ts` — structured log redaction (15 secret patterns), health check aggregation, OTel no-op without package.
- **TEST-017**: `packages/agent/src/subagent.test.ts` — sequential/parallel subagents, depth cap, parent abort propagation.
- **TEST-018**: E2E in `packages/agent/src/agent.e2e.test.ts` — full 3-step loop, session resume after crash, memory search context injection, wiki synthesis pass trigger.
- **TEST-019**: Adversarial: malformed JSON tool args, truncated SSE stream, oversized context, wiki injection payload, invalid plugin checksum.
- **TEST-020**: Performance benchmarks: startup latency (p50 ≤ 500ms, p95 ≤ 900ms), memory retrieval (local p95 ≤ 50ms, remote p95 ≤ 150ms).
- **TEST-MONO-001**: Workspace integrity: `pnpm install --frozen-lockfile` succeeds from clean checkout. All 16 packages appear in `pnpm list`. No circular dependencies in package graph.
- **TEST-MONO-002**: Turbo cache: run `turbo run build` twice; second run must achieve > 90% cache hit rate. Verify with `--dry`.
- **TEST-MONO-003**: Cross-package import validation: no `packages/*/src/**/*.ts` file uses a relative `../` import that crosses a package boundary (enforce via oxlint rule or CI check).

---

## 7. Risks & Assumptions

- **RISK-001**: Circular dependencies in the `@agentsy/*` package graph if module boundaries are not carefully enforced during MONO-1. **Mitigation**: Define the dependency graph in this plan (see Section 8 package graph); add a CI check for circular deps using `madge`.
- **RISK-002**: Turborepo remote cache requires a Vercel account or self-hosted endpoint. **Mitigation**: Scaffold `TURBO_TOKEN`/`TURBO_TEAM` env vars in CI; remote cache is optional (local cache still accelerates builds). Local cache alone provides value.
- **RISK-003**: Breaking change: consumers who pinned `@selfagency/llm-stream-parser` subpath exports will get a deprecation warning but imports still work. **Mitigation**: shim re-exports all existing paths; no consumer code changes required for the shim version.
- **RISK-004**: 16 packages × dual ESM/CJS × TypeScript declarations = large `dist/` surface area. **Mitigation**: `turbo` incremental builds; tsup `external` arrays prevent duplicate bundling of `@agentsy/core`.
- **RISK-005**: libSQL `vector32` API may change between releases. **Mitigation**: pin `@libsql/client` minor version; `VectorStore` interface allows backend swap.
- **RISK-006**: Wiki synthesis LLM call in `endTask()` may be slow or fail. **Mitigation**: async and non-blocking; raw event log always captures truth; log warning on failure.
- **RISK-007**: MCP 2025-06-18 spec may diverge from `@modelcontextprotocol/sdk` current version. **Mitigation**: verify SDK version in TASK-P8-001; file issues if discrepancies found.
- **RISK-008**: Vector embedding dimension mismatch between indexing and query providers. **Mitigation**: store embedding dimension metadata per wiki page; reject queries from different-dimension providers with a clear error.
- **RISK-009**: `WikiStore.writePage()` and wiki synthesis concurrent writes could corrupt pages. **Mitigation**: `proper-lockfile` advisory locking per TASK-X5-004.
- **RISK-010**: Plugin signature key not configured → all plugins untrusted. **Mitigation**: default to `untrusted` mode (no tools loaded); emit `PluginKeyNotConfigured` warning.

### Assumptions

- **ASSUMPTION-001**: PR #46 (Ink renderer) is merged to main before Phase MONO-0 begins. The plan treats the Ink renderer as complete existing source.
- **ASSUMPTION-002**: The `@agentsy` npm org is fully claimed and the publisher account has org-admin access for all packages.
- **ASSUMPTION-003**: Downstream consumer applications are separate git repositories depending on `@agentsy/*` as published npm packages — not monorepo members.
- **ASSUMPTION-004**: All LLM calls for wiki synthesis in `MemoryLifecycle.endTask()` use the same provider already configured in `AgentLoopOptions`; no separate synthesis model config for v0.3.0.
- **ASSUMPTION-005**: Agent Skills spec frontmatter is stable at agentskills.io 1.0 published version.
- **ASSUMPTION-006**: pnpm v9 is the package manager version (already set in `packageManager` field).
- **ASSUMPTION-007**: Turborepo is used for build orchestration only; versioning is handled separately via `scripts/release.js` (existing) or `changesets`.

### SLO Targets

| Metric | Target |
|---|---|
| Startup latency p50 | ≤ 500ms |
| Startup latency p95 | ≤ 900ms |
| First-token latency p50 (warm provider) | ≤ 350ms |
| Streaming repaint budget | ≥ 20 FPS under sustained token stream |
| Memory ceiling (30-min session) | ≤ 220MB |
| Tool reliability (non-destructive built-ins) | ≥ 95% |
| Session resume reliability | ≥ 99% deterministic restore |
| Memory retrieval p95 (local libSQL) | ≤ 50ms |
| Memory retrieval p95 (remote Turso) | ≤ 150ms |
| Wiki synthesis latency | Async / non-blocking (task-end trigger only) |
| Turbo build cache hit rate (warm) | ≥ 90% |

---

## 8. Related Specifications / Further Reading

### Package Dependency Graph

```
@agentsy/tsconfig         (no deps)
@agentsy/core             (no @agentsy deps — zero transitive weight)
@agentsy/normalizers   →  @agentsy/core
@agentsy/processor     →  @agentsy/core, @agentsy/normalizers
@agentsy/agent         →  @agentsy/core, @agentsy/processor
@agentsy/adapters      →  @agentsy/core, @agentsy/agent
@agentsy/ag-ui         →  @agentsy/core, @agentsy/processor
@agentsy/runtime       →  @agentsy/core, @agentsy/agent
@agentsy/context-manager → @agentsy/core, @agentsy/processor
@agentsy/cost-tracker  →  @agentsy/core
@agentsy/session       →  @agentsy/core, @agentsy/processor
@agentsy/mcp           →  @agentsy/core, @agentsy/runtime
@agentsy/providers     →  @agentsy/core, @agentsy/normalizers
@agentsy/retrieval     →  @agentsy/core
@agentsy/memory        →  @agentsy/core, @agentsy/retrieval
@agentsy/telemetry     →  @agentsy/core
@selfagency/llm-stream-parser (shim) →
  @agentsy/core, @agentsy/processor, @agentsy/agent,
  @agentsy/adapters, @agentsy/ag-ui  (all as peerDependencies)
```

### Reference Codebases

- [Claude Code Leaked Source (tanbiralam/claude-code)](https://github.com/tanbiralam/claude-code) — `QueryEngine.ts`, `cost-tracker.ts`, `toolPermission/`, `coordinator/`, `memdir/`, `skills/`, `plugins/`
- [OpenCode (anomalyco/opencode)](https://github.com/anomalyco/opencode) — client/server architecture, LSP integration, provider-agnostic model
- [Hermes Agent (NousResearch/hermes-agent)](https://github.com/NousResearch/hermes-agent) — closed learning loop, skill discovery, FTS5 session search, atomic write + early user-message persistence
- [nanobot (HKUDS/nanobot)](https://github.com/HKUDS/nanobot) — lightweight agent loop, Dream lifecycle, memory as context injection
- [Gemini CLI (google-gemini/gemini-cli)](https://github.com/google-gemini/gemini-cli) — conversation checkpointing, trusted-folders sandbox, token caching, OTel lazy-load
- [OpenAI Codex (openai/codex)](https://github.com/openai/codex) — `codex-rs` safety model, `allow/ask/deny` approval engine
- [vercel/ai](https://github.com/vercel/ai) — `ToolLoopAgent`, `StopCondition` predicates, `prepareStep` callback, `mergeCallbacks`, `toolApproval` as loop-stop result (not throw), `experimental_repairToolCall`, `activeTools`
- [tanstack/ai](https://github.com/tanstack/ai) — `StreamProcessor` per-message `Map` state, `AgentLoopStrategy` combinators, `ChunkStrategy` interface, `areAllToolsComplete()`, lazy UIMessage creation, `replay()`, AG-UI protocol conformance

### Open Standards

- [Agent Skills Open Standard (agentskills.io)](https://agentskills.io/) — skill manifest spec
- [MCP 2025-06-18 Specification](https://modelcontextprotocol.io) — server lifecycle, capability negotiation, trust model
- [AG-UI Protocol](https://docs.ag-ui.com) — `RUN_*`, `STEP_*`, `TEXT_MESSAGE_*`, `TOOL_CALL_*` event vocabulary
- [OpenBrain Tool Surface](https://openbrain.ai) — `memory_search`, `memory_capture`, `memory_list`, `memory_stats`, `memory_lint` conventions
- [Karpathy LLM Wiki Gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) — compiled wiki architectural pattern
- [libSQL / Turso vector32 docs](https://docs.turso.tech/features/vector-similarity-search) — vector store backend for `@agentsy/retrieval`
- [Turborepo documentation](https://turbo.build/repo/docs) — pipeline config, remote caching, workspace conventions

