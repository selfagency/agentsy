---
goal: Phase 4 Advanced Capabilities Implementation for @agentsy Memory and Runtime
version: 1.0
date_created: 2026-05-15
last_updated: 2026-05-15
owner: agentsy-core
status: Planned
tags: [feature, agentfs, content-addressing, sandbox, runtime, phase4]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

This plan defines exhaustive implementation work for Phase 4 in `plan/IMPLEMENTATION-PRIORITY.md`: advanced capabilities across AgentFS-backed memory operations, BLAKE3 content addressing/deduplication, and virtual-first runtime sandboxing with automatic container escalation.

## 1. Requirements & Constraints

- **REQ-001**: Implement AgentFS integration layer for memory/runtime workflows with tool-call auditability.
- **REQ-002**: Implement content addressing using BLAKE3 fingerprints for deduplication and fast lookups across memory artifacts.
- **REQ-003**: Implement virtual-first sandbox execution path in `@agentsy/runtime` with deterministic container trigger rules.
- **REQ-004**: Implement execution routing policy: simple commands run virtual, privileged/heavy workloads escalate to container.
- **REQ-005**: Implement snapshot and rollback support for AgentFS-backed artifacts and workspace state transitions.
- **REQ-006**: Implement lookup indexes for content hashes, reference counts, and cross-entity relationships.
- **REQ-007**: Implement runtime instrumentation for sandbox mode usage, escalation frequency, startup latency, and savings metrics.
- **REQ-008**: Implement policy hooks for secrets handling and path safety across virtual/container modes.
- **REQ-009**: Ensure all APIs remain additive and aligned with package boundaries (`memory`, `runtime`, `tools`, `secrets`, `observability`).
- **REQ-010**: Provide CLI and docs coverage for feature discoverability and operations.
- **SEC-001**: Enforce structural sandbox constraints for undeclared paths and tool permissions.
- **SEC-002**: Prevent secret leakage through audit logs, snapshots, and error payloads.
- **SEC-003**: Require explicit capability policy checks before container escalation for sensitive operations.
- **QOS-001**: Achieve 10x faster virtual sandbox startup versus baseline container startup in benchmark fixtures.
- **QOS-002**: Achieve >= 90% virtual-path execution for simple operations in benchmark task suite.
- **QOS-003**: Keep content-address lookup latency < 10ms average for indexed retrieval paths.
- **CON-001**: Preserve canonical ownership: runtime execution in `@agentsy/runtime`, memory indexing in `@agentsy/memory`, tool interfaces in `@agentsy/tools`.
- **CON-002**: Keep AgentFS integration behind explicit adapter boundaries (no hard coupling to optional providers).
- **CON-003**: Do not block core operation when AgentFS is unavailable; provide fallback with capability downgrade signaling.
- **GUD-001**: Use deterministic fingerprints and idempotent dedup operations.
- **GUD-002**: Keep sandbox trigger logic explicit, testable, and policy-configurable.
- **PAT-001**: Virtual-first execution with selective container escalation.
- **PAT-002**: Content-addressed storage with reference-tracked dedup.
- **PAT-003**: Audit-first file operations with replayable event history.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Build AgentFS integration layer and memory/runtime adapter contracts.

| Task     | Description                                                                                                                 | Completed | Date |
| -------- | --------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-001 | Create `packages/memory/src/filesystem/agentfs/manager.ts` with AgentFS capability detection and adapter lifecycle methods. |           |      |
| TASK-002 | Create `packages/memory/src/filesystem/agentfs/kv-store.ts` for key/value memory artifact operations and metadata tagging.  |           |      |
| TASK-003 | Create `packages/memory/src/filesystem/agentfs/audit-trail.ts` for structured tool-call audit events and correlation IDs.   |           |      |
| TASK-004 | Create `packages/memory/src/filesystem/agentfs/snapshots.ts` for snapshot creation, diff, and rollback metadata.            |           |      |
| TASK-005 | Add integration bridge `packages/tools/src/filesystem/agentfs-adapter.ts` for tool-facing filesystem APIs.                  |           |      |
| TASK-006 | Add tests for AgentFS fallback, audit events, and snapshot workflows.                                                       |           |      |

### Implementation Phase 2

- GOAL-002: Implement BLAKE3 content addressing and dedup indexes.

| Task     | Description                                                                                                                          | Completed | Date |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------- | ---- |
| TASK-007 | Create `packages/memory/src/content-addressing/fingerprint.ts` implementing stable BLAKE3 digest generation and normalization rules. |           |      |
| TASK-008 | Create `packages/memory/src/content-addressing/dedup-store.ts` with reference counting and duplicate suppression on write.           |           |      |
| TASK-009 | Create `packages/memory/src/content-addressing/index.ts` for hash-to-entity lookup indexes and reverse references.                   |           |      |
| TASK-010 | Implement migration utility `packages/memory/src/content-addressing/migrate.ts` to backfill hashes for existing records.             |           |      |
| TASK-011 | Add integrity verification tooling `packages/memory/src/content-addressing/verify.ts` for hash drift detection.                      |           |      |
| TASK-012 | Add performance tests for lookup latency and dedup effectiveness under fixture datasets.                                             |           |      |

### Implementation Phase 3

- GOAL-003: Implement virtual-first sandbox and container trigger engine in `@agentsy/runtime`.

| Task     | Description                                                                                                                            | Completed | Date |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-013 | Create `packages/runtime/src/sandbox/virtual/virtual-sandbox.ts` for lightweight command execution path and environment provisioning.  |           |      |
| TASK-014 | Create `packages/runtime/src/sandbox/virtual/container-detector.ts` with trigger classification for git/browser/full-env requirements. |           |      |
| TASK-015 | Create `packages/runtime/src/sandbox/virtual/dynamic-trigger.ts` implementing policy-based escalation decisions and reason codes.      |           |      |
| TASK-016 | Implement `packages/runtime/src/sandbox/virtual/router.ts` to route execution between virtual and container backends.                  |           |      |
| TASK-017 | Add secrets-safe environment and mount policy integration with `@agentsy/secrets` and runtime policy guards.                           |           |      |
| TASK-018 | Add benchmark and integration tests validating startup speed, routing correctness, and escalation safety.                              |           |      |

### Implementation Phase 4

- GOAL-004: Add production controls, observability, docs, and phase gate validation.

| Task     | Description                                                                                                                                     | Completed | Date |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-019 | Add metrics in `packages/observability` integration points for sandbox mode ratio, startup latency, and escalation outcomes.                    |           |      |
| TASK-020 | Add CLI surfaces in `packages/cli` for sandbox diagnostics and content-address stats reporting.                                                 |           |      |
| TASK-021 | Add cross-package contract tests (`memory` <-> `runtime` <-> `tools` <-> `secrets`) for policy, audit, and fallback behavior.                   |           |      |
| TASK-022 | Update docs in `packages/runtime/README.md`, `packages/memory/README.md`, `docs/packages/runtime.md`, and `docs/examples/`.                     |           |      |
| TASK-023 | Run package-level validation: `pnpm --filter @agentsy/memory test`, `pnpm --filter @agentsy/runtime test`, `pnpm --filter @agentsy/tools test`. |           |      |
| TASK-024 | Run monorepo `pnpm check-types && pnpm test`; record signoff evidence in `plan/PHASE-4-COMPLETION.md`.                                          |           |      |

## 3. Alternatives

- **ALT-001**: Container-only execution. Rejected because it misses the cost/performance objective of virtual-first operation.
- **ALT-002**: Content dedup without cryptographic fingerprints. Rejected due to collision risk and weaker integrity guarantees.
- **ALT-003**: AgentFS mandatory hard dependency. Rejected because optional integration with graceful fallback is required.
- **ALT-004**: Opaque sandbox trigger heuristics. Rejected because explicit, auditable trigger logic is required for safety and operability.

## 4. Dependencies

- **DEP-001**: `@agentsy/runtime` sandbox architecture and execution policy interfaces.
- **DEP-002**: `@agentsy/memory` storage/indexing layers for artifact dedup and lookup.
- **DEP-003**: `@agentsy/tools` filesystem/tool contracts for AgentFS integration points.
- **DEP-004**: `@agentsy/secrets` redaction/schema-first secret handling for execution environments.
- **DEP-005**: `@agentsy/observability` metrics conventions for runtime and memory telemetry.
- **DEP-006**: `@agentsy/cli` command surface for diagnostics and operational tooling.

## 5. Files

- **FILE-001**: `packages/memory/src/filesystem/agentfs/manager.ts`
- **FILE-002**: `packages/memory/src/filesystem/agentfs/kv-store.ts`
- **FILE-003**: `packages/memory/src/filesystem/agentfs/audit-trail.ts`
- **FILE-004**: `packages/memory/src/filesystem/agentfs/snapshots.ts`
- **FILE-005**: `packages/tools/src/filesystem/agentfs-adapter.ts`
- **FILE-006**: `packages/memory/src/content-addressing/fingerprint.ts`
- **FILE-007**: `packages/memory/src/content-addressing/dedup-store.ts`
- **FILE-008**: `packages/memory/src/content-addressing/index.ts`
- **FILE-009**: `packages/memory/src/content-addressing/migrate.ts`
- **FILE-010**: `packages/memory/src/content-addressing/verify.ts`
- **FILE-011**: `packages/runtime/src/sandbox/virtual/virtual-sandbox.ts`
- **FILE-012**: `packages/runtime/src/sandbox/virtual/container-detector.ts`
- **FILE-013**: `packages/runtime/src/sandbox/virtual/dynamic-trigger.ts`
- **FILE-014**: `packages/runtime/src/sandbox/virtual/router.ts`
- **FILE-015**: `packages/runtime/src/sandbox/policy/secrets-guard.ts`
- **FILE-016**: `packages/cli/src/commands/sandbox-diagnostics.ts`
- **FILE-017**: `packages/cli/src/commands/content-address-stats.ts`
- **FILE-018**: `packages/memory/src/index.ts`
- **FILE-019**: `packages/runtime/src/index.ts`
- **FILE-020**: `plan/PHASE-4-COMPLETION.md`

## 6. Testing

- **TEST-001**: AgentFS adapter tests for read/write/list behavior, fallback mode, and capability detection.
- **TEST-002**: Audit-trail tests validating event integrity, correlation IDs, and secret redaction.
- **TEST-003**: Snapshot/rollback tests for deterministic restore behavior and drift detection.
- **TEST-004**: Content fingerprint tests for deterministic hash output and normalization consistency.
- **TEST-005**: Dedup/index tests for reference counting, orphan cleanup, and lookup correctness.
- **TEST-006**: Lookup performance tests for sub-10ms target verification.
- **TEST-007**: Virtual sandbox routing tests for trigger classification and escalation reason correctness.
- **TEST-008**: Sandbox security tests for undeclared path access prevention and secrets-safe environment handling.
- **TEST-009**: Startup benchmark tests comparing virtual vs container startup latency.
- **TEST-010**: Cross-package integration tests for runtime-memory-tools-secrets interactions.
- **TEST-011**: Package and monorepo gates: `pnpm --filter @agentsy/memory test`, `pnpm --filter @agentsy/runtime test`, `pnpm --filter @agentsy/tools test`, `pnpm check-types`, `pnpm test`.

## 7. Risks & Assumptions

- **RISK-001**: Trigger misclassification may route heavy workloads to virtual mode; mitigate with explicit trigger tests and policy overrides.
- **RISK-002**: Hash/index migration of existing artifacts may produce temporary lookup regressions; mitigate with staged migration and verification tooling.
- **RISK-003**: AgentFS backend variability could affect behavior consistency; mitigate with adapter contract tests and fallback strategy.
- **RISK-004**: Observability overhead may affect hot paths; mitigate with sampling controls and lightweight metric instrumentation.
- **ASSUMPTION-001**: Phase 1/2 memory foundations are available and stable for extension.
- **ASSUMPTION-002**: Runtime sandbox architecture can accept additive virtual router modules without breaking current execution flows.
- **ASSUMPTION-003**: CLI and docs pipelines remain available for diagnostics command integration.

## 8. Related Specifications / Further Reading

- `plan/IMPLEMENTATION-PRIORITY.md`
- `plan/MASTER-IMPLEMENTATION-PLAN.md`
- `packages/memory/IMPLEMENTATION-PLAN.md`
- `packages/runtime/IMPLEMENTATION-PLAN.md`
- `packages/tools/IMPLEMENTATION-PLAN.md`
- `packages/secrets/IMPLEMENTATION-PLAN.md`
- `packages/observability/IMPLEMENTATION-PLAN.md`
- `packages/session/IMPLEMENTATION-PLAN.md`
- `docs/packages/memory.md`
- `docs/packages/runtime.md`
