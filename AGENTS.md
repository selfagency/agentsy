# Agent Instructions — @agentsy Monorepo

Production-oriented TypeScript monorepo for LLM stream parsing, agent infrastructure, and VS Code integration. The `plan/` directory contains phased implementation plans but most domains have been promoted to manifest-backed packages.

## Repo Identity

This repository is a **pnpm workspace monorepo** orchestrated with **Turborepo** containing **23 manifest-backed packages**.

### Current packages

Core infrastructure:

- `@agentsy/core` — Stream processing bundle (processor, SSE (Server-Sent Events), XML filter, structured JSON, thinking block parsing, retry, recovery)
- `@agentsy/types` — Shared TypeScript types across all packages
- `@agentsy/providers` — Provider normalizers (Anthropic, OpenAI, Mistral, and others) and API adapters
- `@agentsy/mcp` — Model Context Protocol (MCP) types and utilities

Runtime and orchestration:

- `@agentsy/runtime` — Agent execution runtime with sandboxing and Agent-Generated User Interface (AG-UI) protocol adapter
- `@agentsy/orchestrator` — Agent orchestration and scheduling
- `@agentsy/memory` — Three-tier memory engine (raw event log, synthesized wiki, vector retrieval)
- `@agentsy/session` — Session management and caching
- `@agentsy/tokens` — Token budgeting and output compression
- `@agentsy/guardrails` — Safety and validation boundaries
- `@agentsy/observability` — Metrics and tracing
- `@agentsy/retrieval` — Retrieval-Augmented Generation (RAG) retrieval and indexing
- `@agentsy/models` — Model selection and recommendation

Surfaces and utilities:

- `@agentsy/vscode` — VS Code Language Model Chat Provider integration (currently published)
- `@agentsy/renderers` — CLI, Text-based User Interface (TUI), and renderers (plain text, streaming markdown, Ink components)
- `@agentsy/ui` — UI components and event sourcingng
- `@agentsy/cli` — CLI commands
- `@agentsy/connectors` — Platform connectors (Discord, Slack, Telegram)
- `@agentsy/tools` — Tool implementations and filesystem utilities
- `@agentsy/prompts` — Prompt management
- `@agentsy/plugins` — Plugin system
- `@agentsy/secrets` — Secret management

Build and testing:

- `@agentsy/scripts` (private) — Release and validation scripts
- `@agentsy/testing` (private) — Cross-package integration tests

The **only currently published package** is `@agentsy/vscode`. All others are internal/pre-release.

### Canonical architecture boundaries

- **Core stream/transformation primitives**: `@agentsy/core`
- **Provider adaptation + normalization**: `@agentsy/providers`, `@agentsy/mcp`
- **Orchestration and execution**: `@agentsy/orchestrator`, `@agentsy/runtime`, `@agentsy/guardrails`
- **Durability and long-horizon state**: `@agentsy/session`, `@agentsy/memory`, `@agentsy/tokens`, `@agentsy/retrieval`
- **Surface and presentation**: `@agentsy/renderers`, `@agentsy/ui`, `@agentsy/vscode`, `@agentsy/cli`, `@agentsy/connectors`
- **Extensibility**: `@agentsy/plugins`

> Important: `@agentsy/providers` is an active boundary, not merged into `@agentsy/core`.

## Preferred Workflow

Use the highest-level tool available. Prefer IDE actions and repository-native scripts over ad hoc shell work.

1. **VS Code / language-server actions** for symbol-aware operations
2. **Repository tooling** via root scripts and per-package scripts
3. **Terminal commands** only when no higher-level option exists

## Toolchain and Commands

This repo uses **pnpm + Turborepo** for workspace orchestration. No Taskfile.

### Root commands

Run these from the repository root:

```bash
pnpm build           # turbo run build
pnpm test            # turbo run test
pnpm test:coverage   # turbo run coverage
pnpm check-types     # turbo run check-types
pnpm lint            # turbo run lint
pnpm lint:fix        # turbo run lint -- --fix
pnpm format          # turbo run format
pnpm precommit       # turbo run precommit
pnpm release         # Run release tooling
pnpm fallow          # Run Fallow codebase intelligence
```

### Per-package commands

Use package-local scripts when working on one package in isolation:

```bash
cd packages/vscode && pnpm build
cd packages/vscode && pnpm test
cd packages/vscode && pnpm coverage

// Or any other package:
cd packages/core && pnpm build
cd packages/providers && pnpm test
```

### Completion gate

Before considering work complete, run at minimum:

```bash
pnpm check-types
pnpm test
```

When a change is package-scoped, run the corresponding package scripts first, then root checks if it affects shared code, exports, docs, or monorepo wiring.

## Runtime and Language Baseline

- Develop against **Node.js 22** to match CI (VS Code package declares `>=18`, but repo targets Node 22 consistently)
- Package manager is **pnpm** with workspace: protocol for internal dependencies
- Module system is **ESM-first** (ECMAScript Modules) with `.js` extensions in imports
- Build tool is **tsup**
- Test framework is **Vitest**
- Linter is **oxlint** (Rust-based, type-aware)
- Formatter is **oxfmt** (part of ultracite preset)

## TypeScript Rules

Follow the root `tsconfig.json` as source of truth.

### Strict flags enabled

```json
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "exactOptionalPropertyTypes": true,
  "verbatimModuleSyntax": true,
  "isolatedModules": true,
  "noUncheckedSideEffectImports": true
}
```

### Type safety requirements

- Avoid introducing `any`; when type information is genuinely unknown, use `unknown`, `Record<string, unknown>`, null-prototype objects, or explicit narrowing instead
- Preserve exact optional-property behavior; do not add `undefined` loosely where omission is intended

### Import rules

- Use `.js` extensions in **relative imports inside `.ts` files** (verbatimModuleSyntax)
- Keep imports ESM-compatible throughout the codebase
- Do not use cross-package relative imports like `../../core/...`; use workspace package imports instead (e.g., `@agentsy/core/processor`)

## Linting and Formatting

The repo uses **Biome** via the ultracite preset (oxfmt.config.ts extends ultracite). See .agents/instructions/code-standards.md for coding standards.

### Formatter conventions (oxfmt.config.ts)

```typescript
{
  arrowParens: 'avoid',
  printWidth: 120,
  semi: true,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'none'
}
```

### Linter configuration (oxlint.config.ts)

Enabled plugins: `['eslint', 'typescript', 'unicorn', 'oxc', 'import', 'react', 'jsdoc', 'node', 'promise', 'vitest']`

Key rules:

- Type-aware mode enabled (`typeAware: true`, `typeCheck: true`)
- TypeScript safety: `no-non-null-assertion: error`, `no-unsafe-*: error`
- Relaxed: `max-classes-per-file: off`, `unicorn/no-array-for-each: off`, `unicorn/no-array-reduce: off`
- Vitest: `max-expects: off` to support comprehensive test cases

### Oxlint-disable patterns

For test inputs that intentionally include mixed HTML/XML or other exceptions, use comment disables:

```typescript
/* oxlint-disable xss/no-mixed-html -- Test inputs intentionally include mixed HTML/XML */
```

## Package Boundaries

### `@agentsy/vscode`

- VS Code-specific integration layer
- Depends on internal workspace packages via `workspace:*` protocol
- Preserve ESM-only packaging and explicit externals in tsup.config.ts: `external: ['vscode', ...@agentsy/* peers]`
- Keep VS Code APIs, extension runtime, secret storage, status bars, chat providers, and extension settings here

### `@agentsy/memory`

- Durable knowledge layer, not a hidden orchestration dependency
- Should remain pluggable so consumers can substitute backends when needed
- Prefer abstract interfaces for memory providers, retrievers, and lifecycle hooks
- Expose as both Agentsy-native package and standalone Model Context Protocol (MCP) server or plugin surface when possible

### Internal workspace packages

Important dependencies intentionally not flagged by Fallow (see .fallowrc.jsonc):

```json
"ignoreDependencies": [
  "@agentsy/types", "@agentsy/core", "@agentsy/renderers",
  "@agentsy/runtime", "@agentsy/memory", "@agentsy/providers",
  "@agentsy/session", "@agentsy/tokens"
]
```

These are safe to ignore in unused-dependencies checks — they are workspace packages used as dev/build references across the monorepo.

### General boundary rule

- VS Code extension behavior → `@agentsy/vscode`
- Durable memory/retrieval/persistence → `@agentsy/memory` or memory-adjacent
- Transient token budgets/prompt reduction → `@agentsy/tokens`
- Everything else → appropriate focused package

## Architecture and Code Patterns

### Naming conventions

Follow existing patterns throughout the repo:

- Factory functions: `create*`
- Parser classes: `*Parser`
- Processor classes: `*Processor`
- Validators: `validate*`
- Builders: `build*`
- Extractors: `extract*`
- Managers: `*Manager`
- Adapters: `*Adapter` or `*Bridge`

### Module structure patterns

- Prefer **factory functions** over direct instantiation for public APIs
- Use **classes** for stateful streaming/parser components where the codebase already does so (e.g., `LLMStreamProcessor`, `XmlStreamFilter`)
- Use **functions** for stateless operations and pure transformations
- Use **options objects** with sensible defaults via `??`
- Export public module APIs through `index.ts` barrel files
- Keep tests colocated beside the source they verify (`*.test.ts` next to source)

### Export patterns (from barrel files)

```typescript
// Value exports
export { createFoo, type Bar } from "./foo.js";

// Type-only exports (favored when module exports only types)
export type * from "./types.js";

// Re-exports from sub-modules
export * from "./subpath/index.js";
```

### Entry points and tsup configuration

Packages define multiple entry points in `tsup.config.ts`:

```typescript
export default defineConfig({
  entry: {
    index: "src/index.ts",
    processor: "src/processor/index.ts",
    "xml-filter": "src/xml-filter/index.ts",
    // ...
  },
  external: ["@agentsy/types", "zod"], // Workspace and peer deps
  format: ["esm", "cjs"],
  target: "node18",
  treeshake: true,
});
```

Mirror these entries in `package.json` exports to enable subpath imports like `@agentsy/core/processor`.

### Package.json exports

Align `package.json exports` with tsup entry points:

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    },
    "./processor": {
      "types": "./dist/processor.d.ts",
      "import": "./dist/processor.js",
      "require": "./dist/processor.cjs"
    }
  }
}
```

## Error Handling and Safety

### Streaming/parsing paths

- Prefer graceful degradation for malformed LLM output
- Malformed output should be skipped, partially recovered, or surfaced through warnings rather than thrown exceptions
- Use `onWarning`-style callbacks for recoverable issues in processors/parsers
- Test chunk-by-chunk behavior explicitly, including boundary splits and incomplete chunks

### Setup/validation paths

- Throw explicit `Error` values for invalid configuration, invalid public API input, or impossible setup states
- Validate early, fail fast

### Security posture

- Treat model output as untrusted input
- Preserve existing limits for depth, key counts, nesting, and tool-call size
- Keep privacy-tag scrubbing and safety defaults intact
- Do not weaken bounded parsing, validation, or sanitization logic for convenience

## Testing Conventions

### Test framework

Use **Vitest**. Tests are colocated as `*.test.ts` files beside source.

### Test patterns

- Use `vi.fn()` or equivalent spies for callbacks and event handlers
- For streaming/parsing logic, test chunk-by-chunk behavior explicitly with partial and boundary-split inputs
- Add adversarial and malformed-input cases for parsing and recovery code
- Test warning/recovery behavior through callback spies
- Test safety rails and size/depth limits
- Test exported API behavior, not just internals

### What to test

- Partial chunks and boundary splits
- Empty and malformed input
- Warning and recovery behavior
- Safety rails and size/depth limits
- Exported API behavior, not just internals

### Coverage scripts

- Any package: `cd packages/<name> && pnpm coverage`
- All packages: `pnpm test:coverage`
- Release tooling tests: `pnpm test:release`

### Lint-disable patterns in tests

```typescript
/* oxlint-disable xss/no-mixed-html -- Test inputs intentionally include mixed HTML/XML */
import { describe, expect, it, vi } from "vitest";
```

## Stream Processing Patterns

### Processor behavior

LLMStreamProcessor and similar components:

- Emit structured `StreamChunk` interfaces with `content`, `thinking`, `toolCalls`, `parts`
- Accumulate state across chunks and emit partial results
- Respect configurable limits (e.g., `maxToolCallsPerMessage`, `maxInputLength`)
- Support optional callbacks: `onWarning`, `onText`, `onThinking`, `onDone`
- Track incompleteness on flush: `IncompletenessDetail` indicates missing or incomplete data

### JSON streaming and repair

- Use `stream-json` and structured parsing utilities from `@agentsy/core/structured`
- Support partial JSON repair at chunk boundaries
- Track field-level completion status for streaming progress
- Use `emitPartials: true` for partial object emission during streaming

### Provider normalizers

- Each provider has dedicated normalizer function (e.g., `normalizeAnthropicEvent`, `normalizeOpenAIChatChunk`)
- Convert provider-specific chunks to unified `StreamChunk` format before processor
- Handle provider quirks in normalization layer, not in core processor

## When Adding/Changing Code

### Adding a new package

1. Create `packages/<name>/` with `package.json`, `tsconfig.json`, `tsup.config.ts`
2. Add entry to `pnpm-workspace.yaml` (already has `packages/*`)
3. Add to root `package.json` workspace dependencies if needed
4. Implement build/test/lint scripts
5. Update `README.md` package list if publicly visible
6. Add to `.fallowrc.jsonc` `ignoreDependencies` if it will be used as workspace reference

### Adding subpath exports

1. Add source module under `packages/<name>/src/...`
2. Export from nearest `index.ts` barrel
3. Add tsup entry in `tsup.config.ts`
4. Add matching export in `package.json` exports field
5. Add or update tests for the new entry point
6. Update docs if the API is user-facing

### Changing package structure

- Keep package boundaries explicit
- Preserve independent installability
- Do not accidentally inline or blur package boundaries through incorrect build config
- Update tsup.config.ts entry points accordingly

## Documentation Awareness

### Current documentation truths to preserve

- The repo is a **monorepo** with 23 packages
- Root workflow is **pnpm + turbo** (not Taskfile)
- The only currently published package is `@agentsy/vscode`
- CI uses **Node 22**
- `@agentsy/providers` is an active boundary, not merged into core
- Type safety is strict with no `any` allowed

### Documentation updates

- Update docs when public APIs, commands, package names, or workflows change
- Keep root docs aligned with current monorepo structure (README.md lists current packages)
- Do not reintroduce stale references to obsolete packages or missing tooling
- Update implementation-plan documents only when genuinely planning future work; actual implementation belongs in `IMPLEMENTATION-PLAN.md` files within packages

## CI and Integration

### Workflow awareness

- CI lives in `.github/workflows/` (tests.yml, release.yml, docs-deploy.yml)
- Runs `pnpm install --frozen-lockfile`, `pnpm turbo run coverage`
- Uploads coverage to Codecov, Codacy, and as artifacts
- Node 22 is CI target
- Uses pnpm action-setup and setup-node with `cache: 'pnpm'`

### Keep in sync

- When adding scripts, package paths, coverage outputs, or build artifacts, check whether workflows need updates
- Ensure CI commands match current root scripts and Turbo tasks
- Don't assume one-package release logic; this is a monorepo with 23 packages

## Common Gotchas

- Do **not** recommend `task ...` commands — there is no Taskfile in this repo
- Do **not** use hypothetical package names (`@agentsy/agent`, `@agentsy/adapters`) — they don't exist
- Do **not** add `any` to "fix" strict TypeScript friction — use proper types or `unknown`
- Do **not** forget `.js` extensions on relative TypeScript imports — it's required by verbatimModuleSyntax
- Do **not** place VS Code-specific logic in non-vscode packages
- Do **not** rely on omitted optional properties having `undefined` — exactOptionalPropertyTypes is enabled
- Do **not** assume providers are merged away — `@agentsy/providers` is active
- Do **not** bypass workspace-\* dependencies in favor of relative imports across packages

## Rule of Thumb

When uncertain, optimize for:

1. Consistency with the current monorepo (23 packages, pnpm + turbo)
2. Strict type safety (no `any`, proper `unknown` handling)
3. Clear package boundaries (providers is separate from core)
4. Resilient handling of malformed LLM output (graceful degradation)
5. ESM-first package exports with proper subpaths
6. Comprehensive testing of streaming behavior
7. Docs and CI staying in sync with code
