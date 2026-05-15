---
goal: Phase 2 Turso Sync and Cloud Backup Implementation for @agentsy/memory
version: 1.0
date_created: 2026-05-15
last_updated: 2026-05-15
owner: agentsy-core
status: Complete
tags: [feature, memory, turso, sync, backup, security, observability]
---

# Introduction

![Status: Complete](https://img.shields.io/badge/status-Complete-brightgreen)

This plan implements Phase 2 from `plan/IMPLEMENTATION-PRIORITY.md`: reliable Turso synchronization and cloud backup for the local-first memory coordination system in `@agentsy/memory`. The implementation preserves the existing local honker-first architecture, adds deterministic conflict handling and backup flows, and introduces security and observability controls required for production use.

## 1. Requirements & Constraints

- **REQ-001**: Implement Turso remote synchronization without regressing local-only operation in `@agentsy/memory`.
- **REQ-002**: Implement sync orchestration in `packages/memory/src/sync/` with the concrete modules `turso-manager.ts`, `conflict-resolution.ts`, `sync-scheduler.ts`, and `backup-manager.ts`.
- **REQ-003**: Expose new sync APIs from `packages/memory/src/index.ts` using ESM `.js` relative export paths.
- **REQ-004**: Implement deterministic sync status reporting (`idle|running|error|paused`) and counters for successes, failures, retries, and conflicts.
- **REQ-005**: Implement conflict detection and deterministic merge policies for the three-tier wiki data model (`raw`, `wiki`, `vector`).
- **REQ-006**: Implement manual conflict resolution API for unresolved records with explicit operator action support.
- **REQ-007**: Implement periodic sync scheduling with configurable intervals and retry backoff.
- **REQ-008**: Implement cloud backup workflows supporting snapshot creation, verification, restore, and rollback.
- **REQ-009**: Implement security controls for credentials, encryption mode configuration, and redacted logging.
- **REQ-010**: Implement data integrity validation before upload and after download.
- **REQ-011**: Implement observability hooks for sync latency, queue depth, conflict rate, and backup success rate.
- **REQ-012**: Keep public APIs fully typed and compatible with strict TypeScript rules in the monorepo.
- **SEC-001**: Do not hardcode Turso credentials in source files; credentials must be read from environment or injected configuration only.
- **SEC-002**: Redact secrets from logs, errors, and diagnostics payloads.
- **SEC-003**: Validate untrusted remote payloads before merging into local memory state.
- **SEC-004**: Require explicit restore target validation to prevent accidental destructive overwrite.
- **QOS-001**: Sync reliability target: successful sync completion rate ≥ 95% across integration test scenarios.
- **QOS-002**: Recovery target: backup restore success rate = 100% for valid snapshots.
- **QOS-003**: Latency target: average sync cycle completion < 1500ms in fixture-based integration tests.
- **CON-001**: Preserve existing package boundary: Turso sync logic remains inside `@agentsy/memory`; no VS Code runtime concerns.
- **CON-002**: Preserve current local-first architecture where local coordination continues when remote sync is unavailable.
- **CON-003**: Avoid introducing cross-package relative imports; use package exports conventions.
- **CON-004**: Keep implementation ESM-first and Node.js 22 compatible.
- **GUD-001**: Follow existing naming patterns (`create*`, `*Manager`, `*Scheduler`, `*Resolution`).
- **GUD-002**: Use fail-fast validation for setup/configuration paths, graceful degradation for runtime sync paths.
- **GUD-003**: Add tests colocated with implementation files and validate with `pnpm check-types` and `pnpm test`.
- **PAT-001**: Local-first + remote-shadow sync pattern.
- **PAT-002**: Deterministic conflict resolution with explicit policy ordering.
- **PAT-003**: Retry with bounded exponential backoff and terminal error state.
- **PAT-004**: Snapshot-first backup and restore workflow.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Create sync domain contracts and Turso manager foundation with deterministic status lifecycle.

| Task     | Description                                                                                                                                                                                                                                               | Completed | Date       |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---------- |
| TASK-001 | Create `packages/memory/src/sync/types.ts` defining `SyncStatus`, `SyncMode`, `SyncMetrics`, `SyncError`, `ConflictRecord`, `MergePolicy`, `BackupSnapshot`, `RestoreResult`, `TursoSyncConfig`, `SyncRunResult`, and `RemoteValidationResult`.           | ✅        | 2026-05-15 |
| TASK-002 | Create `packages/memory/src/sync/turso-manager.ts` with `createTursoManager(config: TursoSyncConfig)` and class `TursoManager` methods: `sync(localState)`, `upload(snapshot)`, `download(cursor)`, `getStatus()`, `getMetrics()`, `pause()`, `resume()`. | ✅        | 2026-05-15 |
| TASK-003 | Implement configuration validation in `turso-manager.ts` for required fields (`databaseUrl`, `authToken`, `syncIntervalMs`, `maxRetries`) and fail-fast setup errors.                                                                                     | ✅        | 2026-05-15 |
| TASK-004 | Create `packages/memory/src/sync/turso-client.ts` adapter interface `TursoClient` with concrete HTTP/libSQL transport abstraction for testability.                                                                                                        | ✅        | 2026-05-15 |
| TASK-005 | Add unit tests `packages/memory/src/sync/turso-manager.test.ts` covering status transitions, paused mode, config validation, and basic upload/download success/failure paths.                                                                             | ✅        | 2026-05-15 |
| TASK-006 | Export sync foundation types and manager from `packages/memory/src/index.ts` and add barrel file `packages/memory/src/sync/index.ts`.                                                                                                                     | ✅        | 2026-05-15 |

### Implementation Phase 2

- GOAL-002: Implement deterministic conflict resolution and merge pipeline for local/remote divergence.

| Task     | Description                                                                                                                                                                                         | Completed | Date       |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---------- |
| TASK-007 | Create `packages/memory/src/sync/conflict-resolution.ts` with `resolveConflict(record, policy)` supporting policies `lastWriteWins`, `localWins`, `remoteWins`, `fieldMerge`, and `manualRequired`. | ✅        | 2026-05-15 |
| TASK-008 | Implement deterministic field-merge order for wiki records: `metadata -> content -> relationships -> vectorFingerprint` with per-field precedence map.                                              | ✅        | 2026-05-15 |
| TASK-009 | Add `collectConflicts(localBatch, remoteBatch)` producing normalized `ConflictRecord[]` with stable IDs and timestamps.                                                                             | ✅        | 2026-05-15 |
| TASK-010 | Integrate conflict pipeline into `TursoManager.sync()` sequence: fetch remote delta -> detect conflicts -> apply policy -> produce `SyncRunResult` with resolved/unresolved counts.                 | ✅        | 2026-05-15 |
| TASK-011 | Add unresolved-conflict persistence in `packages/memory/src/sync/conflict-store.ts` for operator/manual resolution workflows.                                                                       | ✅        | 2026-05-15 |
| TASK-012 | Add unit tests `packages/memory/src/sync/conflict-resolution.test.ts` and `packages/memory/src/sync/conflict-store.test.ts` validating deterministic outcomes and unresolved handling.              | ✅        | 2026-05-15 |

### Implementation Phase 3

- GOAL-003: Implement sync scheduler, retry strategy, and cloud backup manager with restore safety.

| Task     | Description                                                                                                                                                                  | Completed | Date       |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---------- |
| TASK-013 | Create `packages/memory/src/sync/sync-scheduler.ts` with `createSyncScheduler(manager, options)` and methods `start()`, `stop()`, `triggerNow()`, `getNextRunAt()`.          | ✅        | 2026-05-15 |
| TASK-014 | Implement bounded exponential backoff in scheduler (`initialDelayMs`, `maxDelayMs`, `maxRetries`) with jitter and terminal error signaling.                                  | ✅        | 2026-05-15 |
| TASK-015 | Create `packages/memory/src/sync/backup-manager.ts` implementing `createSnapshot()`, `verifySnapshot()`, `restoreSnapshot(snapshotId)`, `rollback(restorePointId)`.          | ✅        | 2026-05-15 |
| TASK-016 | Implement backup manifest format in `packages/memory/src/sync/backup-manifest.ts` with hash, createdAt, sourceVersion, and record counts for integrity validation.           | ✅        | 2026-05-15 |
| TASK-017 | Implement pre-restore safety checks in `backup-manager.ts`: target database identity check, schema version compatibility, and explicit `force` gate for destructive restore. | ✅        | 2026-05-15 |
| TASK-018 | Add unit tests `packages/memory/src/sync/sync-scheduler.test.ts`, `packages/memory/src/sync/backup-manager.test.ts`, and `packages/memory/src/sync/backup-manifest.test.ts`. | ✅        | 2026-05-15 |

### Implementation Phase 4

- GOAL-004: Add production controls (security, integrity, observability), wire docs, and validate readiness gates.

| Task     | Description                                                                                                                                                                                                         | Completed | Date       |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---------- |
| TASK-019 | Create `packages/memory/src/sync/security.ts` with secret redaction utilities, credential-source validation, and secure error envelope helpers.                                                                     | ✅        | 2026-05-15 |
| TASK-020 | Create `packages/memory/src/sync/integrity.ts` with payload schema validation and checksum verification for download/import flows.                                                                                  | ✅        | 2026-05-15 |
| TASK-021 | Create `packages/memory/src/sync/metrics.ts` providing counters/timers for `sync_runs_total`, `sync_failures_total`, `sync_conflicts_total`, `backup_runs_total`, `backup_restore_total`, and `sync_duration_ms`.   | ✅        | 2026-05-15 |
| TASK-022 | Add integration tests `packages/memory/src/sync/sync.integration.test.ts` for end-to-end local<->remote sync, conflict scenarios, backup/restore, and offline fallback behavior.                                    | ✅        | 2026-05-15 |
| TASK-023 | Update `packages/memory/README.md` with configuration section (`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `AGENTSY_MEMORY_SYNC_INTERVAL_MS`) and operational examples.                                               | ✅        | 2026-05-15 |
| TASK-024 | Validate Phase 2 gates by running `pnpm --filter @agentsy/memory check-types`, `pnpm --filter @agentsy/memory test`, and monorepo `pnpm check-types && pnpm test`; record outcomes in `plan/PHASE-2-COMPLETION.md`. | ✅        | 2026-05-15 |

## 3. Alternatives

- **ALT-001**: Directly replace local storage with Turso-only remote-first storage. Rejected because it violates local-first coordination guarantees and increases outage sensitivity.
- **ALT-002**: Implement conflict resolution as manual-only. Rejected because it blocks autonomous operation and does not meet reliability targets.
- **ALT-003**: Use a single monolithic sync file (`sync.ts`) for all concerns. Rejected because it reduces testability and conflicts with existing focused module patterns.
- **ALT-004**: Skip backup manifest integrity metadata. Rejected because restore verification would be non-deterministic and unsafe.

## 4. Dependencies

- **DEP-001**: Turso transport dependency integration (`@tursodatabase/sync`) in `packages/memory/package.json`.
- **DEP-002**: Existing local coordination primitives from `packages/memory/src/coordination/*` must remain available during remote outages.
- **DEP-003**: Existing wiki data structures from `packages/memory/src/wiki/wiki-manager.ts` are required for conflict model typing.
- **DEP-004**: Existing fingerprint/reuse metadata (`packages/memory/src/types.ts`, `packages/memory/src/reuse.ts`) is required for integrity and dedup checks.
- **DEP-005**: Environment variable provisioning in runtime hosts for Turso credentials and sync interval.

## 5. Files

- **FILE-001**: `packages/memory/src/sync/types.ts` — Canonical sync/backup type definitions.
- **FILE-002**: `packages/memory/src/sync/turso-client.ts` — Turso client abstraction for transport and mocking.
- **FILE-003**: `packages/memory/src/sync/turso-manager.ts` — Core sync orchestration and status lifecycle.
- **FILE-004**: `packages/memory/src/sync/conflict-resolution.ts` — Deterministic merge policies.
- **FILE-005**: `packages/memory/src/sync/conflict-store.ts` — Unresolved conflict persistence API.
- **FILE-006**: `packages/memory/src/sync/sync-scheduler.ts` — Periodic sync and retry backoff.
- **FILE-007**: `packages/memory/src/sync/backup-manager.ts` — Snapshot, verify, restore, rollback workflows.
- **FILE-008**: `packages/memory/src/sync/backup-manifest.ts` — Backup integrity metadata format.
- **FILE-009**: `packages/memory/src/sync/security.ts` — Secret redaction and secure error handling.
- **FILE-010**: `packages/memory/src/sync/integrity.ts` — Payload validation and checksum verification.
- **FILE-011**: `packages/memory/src/sync/metrics.ts` — Sync and backup observability counters/timers.
- **FILE-012**: `packages/memory/src/sync/index.ts` — Sync module exports.
- **FILE-013**: `packages/memory/src/index.ts` — Public API export wiring.
- **FILE-014**: `packages/memory/package.json` — Dependency and script updates for Turso sync.
- **FILE-015**: `packages/memory/README.md` — Configuration and operational documentation.
- **FILE-016**: `plan/PHASE-2-COMPLETION.md` — Gate evidence, metrics, and sign-off checklist.

## 6. Testing

- **TEST-001**: `packages/memory/src/sync/turso-manager.test.ts` — Status transitions, validation errors, pause/resume, successful sync.
- **TEST-002**: `packages/memory/src/sync/conflict-resolution.test.ts` — All merge policies deterministic and repeatable.
- **TEST-003**: `packages/memory/src/sync/conflict-store.test.ts` — Unresolved conflict persistence and retrieval.
- **TEST-004**: `packages/memory/src/sync/sync-scheduler.test.ts` — Interval scheduling, triggerNow, retry/backoff bounds.
- **TEST-005**: `packages/memory/src/sync/backup-manager.test.ts` — Snapshot create/verify/restore/rollback behavior.
- **TEST-006**: `packages/memory/src/sync/backup-manifest.test.ts` — Manifest hash/metadata verification.
- **TEST-007**: `packages/memory/src/sync/security.test.ts` — Secret redaction and secure error envelopes.
- **TEST-008**: `packages/memory/src/sync/integrity.test.ts` — Payload schema + checksum validation failures/successes.
- **TEST-009**: `packages/memory/src/sync/metrics.test.ts` — Counter/timer registration and updates.
- **TEST-010**: `packages/memory/src/sync/sync.integration.test.ts` — End-to-end local/remote sync, conflicts, offline fallback, backup restore.
- **TEST-011**: Command validation: `pnpm --filter @agentsy/memory check-types` must pass.
- **TEST-012**: Command validation: `pnpm --filter @agentsy/memory test` must pass.
- **TEST-013**: Command validation: `pnpm check-types && pnpm test` must pass with no regressions.

## 7. Risks & Assumptions

- **RISK-001**: Network instability may produce repeated partial sync failures; mitigated by bounded retry/backoff and resumable cursor design.
- **RISK-002**: Schema drift between local and remote records may increase unresolved conflicts; mitigated by versioned manifests and validation gates.
- **RISK-003**: Backup restore misuse could overwrite good local state; mitigated by explicit force gate and pre-restore target checks.
- **RISK-004**: Credential misconfiguration can block sync in production; mitigated by startup validation and actionable diagnostics.
- **RISK-005**: Additional sync logic may increase package complexity; mitigated by focused modules and exhaustive test coverage.
- **ASSUMPTION-001**: Phase 1 primitives in `@agentsy/memory` remain stable during Phase 2 execution.
- **ASSUMPTION-002**: Turso endpoint and token provisioning are available in execution environments.
- **ASSUMPTION-003**: No mandatory cross-package API changes are required outside `@agentsy/memory` for baseline Phase 2 delivery.
- **ASSUMPTION-004**: Existing monorepo CI gates (`pnpm check-types`, `pnpm test`) remain the authoritative validation pipeline.

## 8. Related Specifications / Further Reading

- `plan/IMPLEMENTATION-PRIORITY.md`
- `plan/MASTER-IMPLEMENTATION-PLAN.md`
- `packages/memory/IMPLEMENTATION-PLAN.md`
- `packages/memory/MEMORY-ARCHITECTURE.md`
- `packages/memory/MEMORY-STRATEGY-SYNTHESIS.md`
- `packages/memory/UPDATED-IMPLEMENTATION-PLAN.md`
- `docs/packages/memory.md`
