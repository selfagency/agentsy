---
goal: Systematic remediation of ~7000 linting errors and dead code issues detected by Ultracite (oxlint) and Fallow.
version: 1.0
date_created: 2026-05-15
owner: dev
status: 'Planned'
tags: [architecture, migration, chore]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

This plan outlines a phased approach to resolve the ~7000 linting errors introduced by the addition of Ultracite (powered by oxlint) and dead code issues identified by Fallow. The goal is to reach a zero-error baseline while improving codebase maintainability and performance using automated fixes and targeted refactoring.

## 1. Requirements & Constraints

- **REQ-001**: Achieve a zero-error output from `oxlint` (Ultracite).
- **REQ-002**: Clean up dead code (files, exports, dependencies) identified by `fallow`.
- **CON-001**: Maintain API stability—do not remove symbols that are part of public package interfaces unless confirmed unused across the monorepo.
- **CON-002**: Preserve existing naming conventions where they align with the project's domain, even if they conflict with generic linting rules.
- **PAT-001**: Use `oxlint --fix` for bulk syntax remediation.
- **PAT-002**: Use `fallow fix` for automated dead code removal.

## 2. Implementation Steps

### Phase 1: Automated Bulk Remediation

- GOAL-001: Minimize total error count using safe automated tools.

| Task     | Description                                                                 | Completed | Date |
| -------- | --------------------------------------------------------------------------- | --------- | ---- |
| TASK-001 | Run `oxlint --fix` to resolve auto-fixable syntax issues (curly, arrow).    |           |      |
| TASK-002 | Run `fallow fix --yes` to remove unused exports and dependencies.          |           |      |
| TASK-003 | Delete identified unused files (`oxfmt.config.ts`, `oxlint.config.ts`).      |           |      |

### Phase 2: Configuration & Rule Tuning

- GOAL-002: Resolve systemic noise by tuning linter rules to project needs.

| Task     | Description                                                                 | Completed | Date |
| -------- | --------------------------------------------------------------------------- | --------- | ---- |
| TASK-004 | Audit `unicorn(filename-case)` errors; decide on Kebab or Pascal case.      |           |      |
| TASK-005 | Update `oxlint.config.ts` to downgrade or disable overly pedantic rules.    |           |      |
| TASK-006 | Update `.fallowrc.jsonc` to whitelist intentionally unused class members.   |           |      |

### Phase 3: Targeted Refactoring

- GOAL-003: Resolve remaining complex issues requiring manual effort.

| Task     | Description                                                                 | Completed | Date |
| -------- | --------------------------------------------------------------------------- | --------- | ---- |
| TASK-007 | Refactor `LLMStreamProcessor` family to address filename and func-style.    |           |      |
| TASK-008 | Cleanup unused enum members in `packages/types` and `packages/orchestrator`.|           |      |
| TASK-009 | Resolve remaining 100+ manual `oxlint` findings per package.               |           |      |

## 3. Alternatives

- **ALT-001**: Ignoring the linting errors. Rejected because it masks real potential bugs and technical debt.
- **ALT-002**: Disabling all rules immediately. Rejected because it defeats the purpose of adding high-quality tooling.

## 4. Dependencies

- **DEP-001**: `oxlint` (@oxc-project)
- **DEP-002**: `fallow`
- **DEP-003**: `ultracite`

## 5. Files

- **FILE-001**: `oxlint.config.ts`
- **FILE-002**: `.fallowrc.jsonc`
- **FILE-003**: `packages/core/src/processor/processor/LLMStreamProcessor.ts`
- **FILE-004**: `packages/types/src/agents.ts`

## 6. Testing

- **TEST-001**: `pnpm check-types` must pass after remediation.
- **TEST-002**: `turbo run test` must pass to ensure no functional regressions.

## 7. Risks & Assumptions

- **RISK-001**: Automated fixes might break runtime reflection if not careful with classes.
- **ASSUMPTION-001**: `oxlint --fix` is stable enough for bulk usage in this monorepo.

## 8. Related Specifications / Further Reading

- [Ultracite Documentation](https://docs.ultracite.ai/)
- [Fallow SKILL.md](/.agents/skills/fallow/SKILL.md)
