---
goal: Phase 0 Token Reduction Foundation Implementation for @agentsy
version: 1.0
date_created: 2026-05-15
last_updated: 2026-05-15
owner: agentsy-core
status: In progress
tags: [feature, tokens, compression, cli, benchmarks, phase0]
---

# Introduction

![Status: In progress](https://img.shields.io/badge/status-In%20progress-yellow)

This plan defines exhaustive implementation work for Phase 0 in `plan/IMPLEMENTATION-PRIORITY.md`: output compression and memory-file compression as standalone utilities with CLI and benchmark-backed acceptance gates.

## 1. Requirements & Constraints

- **REQ-001**: Implement output compression APIs in `@agentsy/tokens` with deterministic behavior and intensity levels `lite|full|ultra`.
- **REQ-002**: Implement memory-file compression APIs in `@agentsy/core/context` with backup-safe write workflows.
- **REQ-003**: Provide CLI commands in `@agentsy/cli`: `compress` and `compress-memory`.
- **REQ-004**: Implement preservation rules for code blocks, URLs, file paths, Markdown structure, and warnings/errors.
- **REQ-005**: Implement benchmark suites for compression effectiveness and latency.
- **REQ-006**: Implement metrics output (`beforeTokens`, `afterTokens`, `savingsPercent`, `durationMs`) for each compression operation.
- **REQ-007**: Implement programmatic exports from package barrel files for standalone library usage.
- **REQ-008**: Implement batch processing mode for memory-file compression.
- **REQ-009**: Document operational and API usage in package READMEs and docs pages.
- **REQ-010**: Validate no regressions using monorepo typecheck/test gates.
- **SEC-001**: Preserve credential placeholders and redacted-secret patterns during compression.
- **SEC-002**: Prevent unsafe overwrite when backup is requested and destination exists.
- **SEC-003**: Reject path traversal and non-file inputs for CLI file operations.
- **QOS-001**: Compression operation latency target < 10ms average on fixture dataset.
- **QOS-002**: Compression accuracy target 100% semantic preservation for technical content fixtures.
- **CON-001**: Preserve ESM exports and strict TypeScript constraints.
- **CON-002**: No shell-based file mutation for implementation; use package APIs and file utilities.
- **GUD-001**: Prefer deterministic transforms over heuristic randomness.
- **GUD-002**: Keep implementation modular in dedicated compression subfolders.
- **PAT-001**: Preserve-first compression pipeline: tokenize -> protect -> compress -> restore.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Complete output compression module hardening in `@agentsy/tokens`.

| Task     | Description                                                                                                                                   | Completed | Date                                          |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------- | --------------------------------------------- | --- | --- |
| TASK-001 | Create/verify `packages/tokens/src/compression/compressor.ts` implementing `compressOutput(response, options)` with deterministic transforms. |           |                                               |
| TASK-002 | Create/verify `packages/tokens/src/compression/levels.ts` defining `lite                                                                      | full      | ultra` strategy tables and fallback defaults. |     |     |
| TASK-003 | Create/verify `packages/tokens/src/compression/config.ts` exposing typed defaults and preservation toggles.                                   |           |                                               |
| TASK-004 | Implement preservation guards for fenced code blocks, inline code, URLs, file paths, and markdown headings/lists.                             |           |                                               |
| TASK-005 | Add tests in `packages/tokens/src/compression/compressor.test.ts` for each level and preservation class.                                      |           |                                               |
| TASK-006 | Add benchmark tests in `packages/tokens/src/compression/compressor.benchmark.test.ts` asserting ratio and latency thresholds.                 |           |                                               |

### Implementation Phase 2

- GOAL-002: Complete memory-file compression module and backup safety in `@agentsy/core/context`.

| Task     | Description                                                                                                                                | Completed | Date |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ---- |
| TASK-007 | Create/verify `packages/core/src/context/compression/memory/compressor.ts` implementing `compressMemoryFile(filePath, options)`.           |           |      |
| TASK-008 | Create/verify `packages/core/src/context/compression/preservation/rules.ts` for byte-level preserve/restore rules.                         |           |      |
| TASK-009 | Create/verify `packages/core/src/context/compression/backup/manager.ts` supporting `.original.md` snapshot creation and rollback metadata. |           |      |
| TASK-010 | Implement batch mode `compressMemoryFiles(filePaths, options)` in `packages/core/src/context/compression/memory/batch.ts`.                 |           |      |
| TASK-011 | Add tests `packages/core/src/context/compression/memory/compressor.test.ts` for single-file and backup workflows.                          |           |      |
| TASK-012 | Add tests `packages/core/src/context/compression/memory/batch.test.ts` for multi-file operations and partial-failure handling.             |           |      |

### Implementation Phase 3

- GOAL-003: Complete CLI wiring and user-facing contracts in `@agentsy/cli`.

| Task     | Description                                                                                                                    | Completed | Date |
| -------- | ------------------------------------------------------------------------------------------------------------------------------ | --------- | ---- |
| TASK-013 | Create/verify `packages/cli/src/commands/compress.ts` supporting `--level`, `--file`, `--stdin`, and JSON summary output.      |           |      |
| TASK-014 | Create/verify `packages/cli/src/commands/compress-memory.ts` supporting `--file`, `--glob`, `--backup`, `--dry-run`, `--json`. |           |      |
| TASK-015 | Wire commands into `packages/cli/src/index.ts` and command registry with consistent error codes.                               |           |      |
| TASK-016 | Add CLI tests `packages/cli/src/commands/compress.test.ts` and `compress-memory.test.ts` including failure-paths.              |           |      |
| TASK-017 | Add end-to-end command tests `packages/cli/src/e2e/compression.e2e.test.ts` for representative fixtures.                       |           |      |
| TASK-018 | Update `packages/cli/README.md` with usage, flags, examples, and expected output schema.                                       |           |      |

### Implementation Phase 4

- GOAL-004: Validate benchmarks, publish docs, and close Phase 0 gates.

| Task     | Description                                                                                                                                                                     | Completed | Date |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-019 | Add fixture dataset under `packages/testing/fixtures/compression/` for technical-accuracy validation.                                                                           |           |      |
| TASK-020 | Add shared benchmark helper `packages/testing/src/benchmarks/compression-metrics.ts` for repeatable measurement.                                                                |           |      |
| TASK-021 | Update docs in `docs/packages/tokens.md`, `docs/packages/context.md`, and `docs/examples/` compression examples.                                                                |           |      |
| TASK-022 | Run `pnpm --filter @agentsy/tokens check-types && pnpm --filter @agentsy/tokens test`.                                                                                          |           |      |
| TASK-023 | Run `pnpm --filter @agentsy/core check-types && pnpm --filter @agentsy/core test`.                                                                                              |           |      |
| TASK-024 | Run `pnpm --filter @agentsy/cli check-types && pnpm --filter @agentsy/cli test`, then monorepo `pnpm check-types && pnpm test`; store evidence in `plan/PHASE-0-COMPLETION.md`. |           |      |

## 3. Alternatives

- **ALT-001**: Single global compression level only. Rejected because use-cases require adjustable readability/compactness tradeoffs.
- **ALT-002**: Compression without preservation guards. Rejected because it risks technical correctness loss.
- **ALT-003**: CLI-only implementation without library exports. Rejected because standalone programmatic use is required.
- **ALT-004**: In-place overwrite without backup capability. Rejected for safety and rollback requirements.

## 4. Dependencies

- **DEP-001**: `@agentsy/tokens` compression modules and tests.
- **DEP-002**: `@agentsy/core` context compression and backup manager modules.
- **DEP-003**: `@agentsy/cli` command framework and option parser.
- **DEP-004**: Shared testing fixtures and benchmark helpers in `@agentsy/testing`.
- **DEP-005**: Existing docs and package export boundaries in monorepo.

## 5. Files

- **FILE-001**: `packages/tokens/src/compression/compressor.ts`.
- **FILE-002**: `packages/tokens/src/compression/levels.ts`.
- **FILE-003**: `packages/tokens/src/compression/config.ts`.
- **FILE-004**: `packages/tokens/src/compression/compressor.test.ts`.
- **FILE-005**: `packages/core/src/context/compression/memory/compressor.ts`.
- **FILE-006**: `packages/core/src/context/compression/preservation/rules.ts`.
- **FILE-007**: `packages/core/src/context/compression/backup/manager.ts`.
- **FILE-008**: `packages/core/src/context/compression/memory/batch.ts`.
- **FILE-009**: `packages/cli/src/commands/compress.ts`.
- **FILE-010**: `packages/cli/src/commands/compress-memory.ts`.
- **FILE-011**: `packages/testing/fixtures/compression/*`.
- **FILE-012**: `plan/PHASE-0-COMPLETION.md`.

## 6. Testing

- **TEST-001**: Output compression level behavior and deterministic output snapshots.
- **TEST-002**: Preservation tests for code, URLs, paths, headings, and warning text.
- **TEST-003**: Memory-file compression + backup/restore safety tests.
- **TEST-004**: Batch compression multi-file partial-failure tests.
- **TEST-005**: CLI parsing and error-code behavior tests.
- **TEST-006**: E2E command tests with fixture files and JSON output validation.
- **TEST-007**: Benchmark tests for latency and savings thresholds.
- **TEST-008**: Package-level check-types + test gates for `tokens`, `core`, `cli`.
- **TEST-009**: Monorepo-wide `pnpm check-types` and `pnpm test`.

## 7. Risks & Assumptions

- **RISK-001**: Compression ratios may vary by dataset and miss target windows.
- **RISK-002**: Over-aggressive transforms may reduce readability for humans.
- **RISK-003**: Backup file growth for large batch runs may affect disk usage.
- **RISK-004**: CLI UX complexity may increase support burden.
- **ASSUMPTION-001**: Existing package scripts and test runners remain stable.
- **ASSUMPTION-002**: Compression fixture dataset remains representative of production responses.
- **ASSUMPTION-003**: Existing APIs for `tokens` and `core/context` can accept additive exports without breaking consumers.

## 8. Related Specifications / Further Reading

- `plan/IMPLEMENTATION-PRIORITY.md`
- `plan/PHASE-0-COMPLETION.md`
- `docs/packages/tokens.md`
- `docs/packages/cli.md`
- `docs/packages/context.md`
