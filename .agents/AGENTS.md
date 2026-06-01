# Agent Instructions — @agentsy Monorepo

Production-oriented TypeScript monorepo for LLM stream parsing, agent infrastructure, and VS Code integration. The `plan/` directory defines the broader `@agentsy/*` package roadmap.

## Repo Identity

- This repository is a **pnpm workspace monorepo** orchestrated with **Turborepo**.
- Packages live under `packages/`. The only currently **published** package is:
  - `packages/vscode` → `@agentsy/vscode`: VS Code Language Model Chat Provider utilities.
- Additional packages exist under `packages/` as internal/pre-release packages such as `core`, `providers`, `runtime`, `orchestrator`, `tokens`, `renderers`, `ui`, `types`, and `integration` (private).
- The `plan/` directory is not throwaway notes. It contains the product and technical direction for future package extraction and platform evolution. When implementing planned packages or major architectural work, consult:
  - `plan/agentsy-prd.md`
  - `plan/agentsy-tech.md`
  - `plan/agentsy-platform-v2.md`

## Preferred Workflow

Use the highest-level tool available. Prefer IDE actions and repository-native scripts over ad hoc shell work.

1. **VS Code / language-server actions** for symbol-aware operations.
2. **Repository tooling** via root scripts and per-package scripts.
3. **Terminal commands** only when no higher-level option exists.

## Toolchain and Commands

This repo uses **pnpm + Turborepo**, not a Taskfile-driven workflow.

### Root commands

Run these from the repository root:

```bash
pnpm build           # turbo run build
pnpm test            # turbo run test
pnpm test:coverage   # turbo run coverage
pnpm check-types     # turbo run check-types
pnpm lint            # turbo run lint
pnpm lint:fix        # turbo run lint:fix
pnpm format          # turbo run format
pnpm precommit       # turbo run precommit
```

### Per-package commands

Use package-local scripts when working on one package in isolation:

```bash
cd packages/vscode && pnpm build
cd packages/vscode && pnpm test
cd packages/vscode && pnpm coverage

# Or any other package, e.g.:
cd packages/processor && pnpm build
cd packages/normalizers && pnpm test
```

### Completion gate

Before considering work complete, run at minimum:

```bash
pnpm check-types
pnpm test
```

When a change is package-scoped, you may run the corresponding package scripts first, but finish with the relevant root checks if the change affects shared code, exports, docs, or monorepo wiring.

## Runtime and Language Baseline

- Develop against **Node.js 22** to match CI.
- `packages/vscode` declares `>=18`, but repo development should still target Node 22 for consistency.
- Package manager is **pnpm**.
- Module system is **ESM-first**.
- Build tool is **tsup**.
- Test framework is **Vitest**.
- Linter is **oxlint**.
- Formatter is **oxfmt**.

## TypeScript Rules

Follow the root `tsconfig.json` as the source of truth.

- `strict: true`
- `noUncheckedIndexedAccess: true`
- `exactOptionalPropertyTypes: true`
- `verbatimModuleSyntax: true`
- `isolatedModules: true`
- `noUncheckedSideEffectImports: true`

### Type safety requirements

- Never introduce `any`.
- Prefer `unknown`, `Record<string, unknown>`, null-prototype objects, and explicit narrowing for untrusted shapes.
- Preserve exact optional-property behavior; do not add `undefined` loosely where omission is intended.

### Import rules

- Use `.js` extensions in **relative imports inside `.ts` files**.
- Keep imports ESM-compatible.
- Do not use cross-package relative imports like `../../core/...`; use workspace package imports instead.

## Linting and Formatting

- Use **oxlint**, not ESLint.
- Use **oxfmt**, not Prettier.
- Respect root config in:
  - `.oxlintrc.json`
  - `.oxfmtrc.json`

Key formatter conventions:

- `singleQuote: true`
- `semi: true`
- `printWidth: 120`
- `arrowParens: avoid`
- `tabWidth: 2`

## Package Boundaries

### `@agentsy/memory` and memory-adjacent modules

- `@agentsy/memory` should be treated as a durable knowledge layer, not a hidden orchestration dependency.
- It must remain pluggable so consumers can substitute their own memory backend or memory system.
- Prefer abstract interfaces for memory providers, retrievers, lifecycle hooks, and summarization adapters.
- When possible, expose memory both as:
  - an Agentsy-native package
  - a standalone MCP server / plugin surface that can be used independently of the rest of Agentsy
- `@agentsy/tokens` should consume memory through optional adapters and shared interfaces, not hard-coded persistence assumptions.
- `@agentsy/subagents` should be able to work with external or substitute memory systems through the same abstractions.

### General boundary rule

- If code depends on VS Code extension runtime behavior, editor integration, secret storage, status bars, chat providers, or extension settings, it belongs in `@agentsy/vscode`.
- If code is about durable memory, retrieval, persistence, or memory lifecycle, it belongs in `@agentsy/memory` or a memory-adjacent package.
- If code is about transient token budgets, prompt reduction, or output shaping, it belongs in `@agentsy/tokens`.
- Everything else belongs in the appropriate focused package.

## Architecture and Naming Conventions

Follow existing naming patterns throughout the repo:

- Factory functions: `create*`
- Parser classes: `*Parser`
- Processor classes: `*Processor`
- Validators: `validate*`
- Builders: `build*`
- Extractors: `extract*`

### Code structure patterns

- Prefer **factory functions** over direct instantiation for public APIs.
- Use **classes** for stateful streaming/parser components where the codebase already does so.
- Use **options objects** with sensible defaults via `??`.
- Export public module APIs through `index.ts` barrel files.
- Keep tests colocated beside the source they verify.

## Error Handling and Safety

This repo distinguishes between setup-time failures and streaming-time resilience.

### Streaming/parsing paths

- Prefer graceful degradation.
- Malformed LLM output should usually be skipped, partially recovered, or surfaced through warnings rather than thrown exceptions.
- Use `onWarning`-style callbacks for recoverable issues.

### Setup/validation paths

- Throw explicit `Error` values for invalid configuration, invalid public API input, or impossible setup states.

### Security posture

- Treat model output as untrusted input.
- Preserve existing limits for depth, key counts, nesting, and tool-call size.
- Keep privacy-tag scrubbing and safety defaults intact.
- Do not weaken bounded parsing, validation, or sanitization logic for convenience.

## Exports and Packaging

### When adding a new package or subpath export

Update all relevant surfaces together:

1. Add the source module under `packages/<name>/src/...`
2. Export it from the nearest `index.ts` barrel
3. Add a tsup entry in `packages/<name>/tsup.config.ts`
4. Add the matching export in `packages/<name>/package.json`
5. Add or update tests
6. Update docs when the new API is user-facing

### When changing package structure

- Keep package boundaries explicit.
- Preserve independent installability.
- Do not accidentally inline or blur package boundaries through incorrect build config.

## Testing Conventions

- Use **Vitest**.
- Keep tests colocated as `*.test.ts` files.
- For parser and streaming logic, test chunk-by-chunk behavior explicitly.
- Add adversarial and malformed-input cases for parsing and recovery code.
- Use `vi.fn()` or equivalent spies for callbacks and event handlers.

### What to test

- Partial chunks and boundary splits
- Empty and malformed input
- Warning and recovery behavior
- Safety rails and size/depth limits
- Exported API behavior, not just internals

### Coverage scripts

- Any package: `cd packages/<name> && pnpm coverage`
- All packages: `pnpm test:coverage`

## Documentation Rules

- Update docs when public APIs, commands, package names, or workflows change.
- Keep root docs aligned with the current monorepo structure.
- Do not reintroduce stale references to obsolete package names, old folder layouts, or missing tooling.

### Current documentation truths to preserve

- The repo is a **monorepo**.
- Root workflow is **pnpm + turbo**.
- The only currently published package is `@agentsy/vscode`.
- CI uses **Node 22**.

## Documentation Search and Planning

Before major architectural work, review the relevant plan documents. Use them especially when:

- adding new `@agentsy/*` packages
- implementing agent runtime, memory, provider, MCP, or session features
- aligning current code with the long-term platform architecture

The plans describe intended package boundaries, dependency direction, and API contracts. Use them as guidance, but verify against the actual current code before editing.

## CI and Release Awareness

- CI workflows live under `.github/workflows/`.
- Keep commands aligned with the current root scripts and Turbo tasks.
- Do not assume one-package release logic in monorepo changes.
- When changing scripts, package paths, coverage outputs, or build artifacts, check whether workflows also need updates.

## Common Gotchas

- Do **not** recommend `task ...` commands unless a real Taskfile is added to the repo.
- Do **not** use old package names such as `@agentsy/parser`, `@agentsy/core`, or pre-monorepo paths.
- Do **not** add `any` to "fix" strict TypeScript friction.
- Do **not** forget `.js` extensions on relative TypeScript imports.
- Do **not** place VS Code-specific logic in non-vscode packages.

## Rule of Thumb

When uncertain, optimize for:

1. consistency with the current monorepo
2. strict type safety
3. clear package boundaries
4. resilient handling of malformed LLM output
5. docs and CI staying in sync with code
