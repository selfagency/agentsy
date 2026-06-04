---
goal: BIDIRECTIONAL GAP ANALYSIS (TODO vs Package Plans)
created: 2026-05-17
status: FINAL

# Bidirectional Gap Analysis

This document identifies gaps between:
1. **TODO.txt** (high-level task tracking with estimated progress)
2. **Package IMPLEMENTATION-PLAN.md** (detailed task-level requirements per package)
3. **Actual code implementation** (verified through compliance matrix)

---

## Section 1: Package Plans → TODO (Missing from TODO)

The following detailed tasks from package implementation plans are NOT captured in TODO.txt:

### @agentsy/cli (18+ detailed tasks missing)

Package plan tasks not in TODO:

- TASK-CLI-001: Align CLI command-routing contracts with oclif/core
- TASK-CLI-002: Stabilize typed config contracts and precedence diagnostics
- TASK-CLI-003: Publish boundary notes for shell composition vs package-owned
- TASK-CLI-013: Define oclif plugin stack (11 plugin types)
- TASK-CLI-021: Define cmux integration contracts (transport, capability probing, context detection)
- TASK-CLI-026: Define subagent-pane orchestration contracts inspired by cmux
- TASK-CLI-004: Complete interactive shell flows (chat, chooser, panes, approvals, config edit, slash)
- TASK-CLI-005: Implement deterministic headless and JSON operation modes
- TASK-CLI-006: Finalize project-aware context insertion (@) with budget-aware previews
- TASK-CLI-014: Add rune-style banner, splash, and motion-safe status components
- TASK-CLI-015: Implement plugin-backed command discovery, commands listing, version, help, search, which
- TASK-CLI-018: Add bundled-superagent bootstrap
- TASK-CLI-019: Add /agent-mode and startup picker workflows
- TASK-CLI-022: Implement native cmux command surfaces
- TASK-CLI-023: Implement sidebar metadata publishing hooks
- TASK-CLI-027: Implement cmux-native subagent split orchestration
- TASK-CLI-030: Implement discovery-gated cmux exposure
- TASK-CLI-007-009: Integration tests and operator diagnostics

TODO only mentions: "No CLI framework, no commands, no TUI" (generic)

### @agentsy/core (12 detailed tasks missing)

Package plan tasks not in TODO:

- TASK-CORE-001: Freeze normalized chunk/event type contracts
- TASK-CORE-002: Add compile-time snapshots for processor and normalizer
- TASK-CORE-003: Document ownership boundaries in package docs
- TASK-CORE-004: Finalize adapters/normalizers/processor behavior
- TASK-CORE-005: Complete deterministic context assembly and compression
- TASK-CORE-006: Implement typed error taxonomy and recovery signals
- TASK-CORE-007: Validate runtime/orchestrator/provider integration
- TASK-CORE-008: Add compatibility tests for renderer and UI consumers
- TASK-CORE-009: Ensure token/memory/session boundaries respected
- TASK-CORE-010: Add regression/performance suites for stream correctness
- TASK-CORE-011: Update docs for stable APIs
- TASK-CORE-012: Pass monorepo release gates

TODO only mentions: "65% for stream processing, but critical UniversalClient is placeholder"

### @agentsy/guardrails (12 tasks + ethical rules missing)

Package plan tasks not in TODO:

- TASK-GUARDRAILS-001: Finalize policy schema, decision envelope, reason codes
- TASK-GUARDRAILS-002: Add deterministic evaluation contract tests
- TASK-GUARDRAILS-003: Align package boundaries with runtime/tools/retrieval
- TASK-GUARDRAILS-004: Implement layered policy evaluators
- TASK-GUARDRAILS-005: Implement transform/redact and escalation
- TASK-GUARDRAILS-006: Add local-first policy-pack loading
- TASK-GUARDRAILS-007: Integrate runtime hook points
- TASK-GUARDRAILS-008: Add red-team coverage via testing
- TASK-GUARDRAILS-009: Validate observability/audit trace completeness
- TASK-GUARDRAILS-010: Add regression suites for policy drift
- TASK-GUARDRAILS-011: Update policy docs and operator guidance
- TASK-GUARDRAILS-012: Pass release gates
- TASK-G000, TASK-G000A-D: Load and version project policy documents, build policy registry, define policy precedence, enforce ethical rules, add policy-linked refusals

TODO only mentions: "All providers are abstract base classes; 0/4 usable"

### @agentsy/orchestrator (12 tasks + agent mode infrastructure missing)

Package plan tasks not in TODO:

- TASK-ORCH-001: Finalize planner/strategy interfaces
- TASK-ORCH-002: Stabilize task-board and persistence abstraction
- TASK-ORCH-003: Document orchestration ownership vs runtime/tools
- TASK-ORCH-004: Implement deterministic plan/act loops
- TASK-ORCH-005: Implement mode profiles and fallback/downgrade
- TASK-ORCH-006: Finalize task persistence and scheduling/backoff
- TASK-ORCH-013: Add mode-contract support for research/plan/agent supermodes
- TASK-ORCH-007: Integrate CLI/runtime slash controls
- TASK-ORCH-008: Add integration tests for budget rejection/downscoping
- TASK-ORCH-009: Validate observability and session interaction coverage
- TASK-ORCH-010: Add regressions for autonomy safety
- TASK-ORCH-011: Align docs and custom-agent guidance
- TASK-ORCH-012: Pass package and monorepo release gates
- TASK-AG1-001 to TASK-AG1-005: Create packages/agents/, define AgentModeFactory, create skill directory tree, export stub barrel, add to turbo
- TASK-AG2-001 to TASK-AG2-002: Bundle caveman v1.7.0 and superpowers v5.0.7 SKILL.md files

TODO only mentions: "No slash commands system, No agent mode bundles, No Hook system"

### @agentsy/observability (22 detailed tasks missing)

Package plan tasks not in TODO:

- TASK-OBS-001: Stabilize trace/span/event contracts
- TASK-OBS-002: Add redaction contract tests and schema validation
- TASK-OBS-003: Document ownership boundaries and package integration
- TASK-OBS-013: Define semantic conventions for AgentSpan, model calls, tool calls
- TASK-OBS-019: Define universal logger contracts for tslog-backed implementation
- TASK-OBS-004: Implement trace assembly, correlation IDs, exporter abstraction
- TASK-OBS-005: Implement token/cost/latency metric aggregation
- TASK-OBS-006: Finalize redaction and safe export pipelines
- TASK-OBS-014: Add first-class sink/adapters (console, file, OTLP, local debug)
- TASK-OBS-015: Add replay-friendly record format for deterministic debugging
- TASK-OBS-020: Implement tslog-backed logger engine and adapter bridge
- TASK-OBS-007: Integrate runtime/orchestrator/tools/memory/providers telemetry
- TASK-OBS-008: Expose CLI/VS Code diagnostics and trace inspection
- TASK-OBS-009: Add integration tests for trace completeness
- TASK-OBS-016: Add instrumentation modules for framework surfaces
- TASK-OBS-017: Make direct instrumentation usable without bootstrap
- TASK-OBS-021: Integrate universal logger factories across all domain surfaces
- TASK-OBS-010-012: Add regressions, update docs, pass release gates

TODO only mentions: "No OpenTelemetry integration, No AgentSpan, No AI-specific events"

### @agentsy/runtime (12 tasks, mostly complete in plan but not reflected in TODO)

Package plan tasks (TASK-RUNTIME-001 to -006 all marked ✅ complete 2026-05-17):

- TASK-RUNTIME-007: Integrate tools/guardrails/session/memory/retrieval
- TASK-RUNTIME-008: Add integration tests for approval/policy/resume
- TASK-RUNTIME-009: Emit runtime lifecycle telemetry
- TASK-RUNTIME-010: Add stress/failure-mode suites
- TASK-RUNTIME-011: Update docs/examples for operator-safe runtime
- TASK-RUNTIME-012: Pass package and monorepo release gates

TODO says: "~30% complete, Expected agent runtime but got task executor, No agent loop, no sandbox, no approval engine"
BUT PLAN SAYS: Tasks 1-6 are COMPLETE with dates 2026-05-17

### @agentsy/session (12 tasks, mostly complete in plan but not reflected in TODO)

Package plan tasks (TASK-SESSION-001 to -006 all marked ✅ complete 2026-05-17):

- TASK-SESSION-007: Integrate runtime loop persistence and CLI resume
- TASK-SESSION-008: Add integration tests for interruption/restart
- TASK-SESSION-009: Validate memory/runtime boundary behavior
- TASK-SESSION-010: Add regressions for corruption/upgrade/concurrency
- TASK-SESSION-011: Align docs/examples for operational workflows
- TASK-SESSION-012: Pass package and monorepo release gates

TODO says: "5% complete, In-memory only, no persistence across restarts"
BUT PLAN SAYS: Tasks 1-6 are COMPLETE with dates 2026-05-17

### @agentsy/secrets (12 detailed tasks missing)

Package plan tasks not in TODO:

- TASK-SECRETS-001: Stabilize secrets API contract and backend selection precedence
- TASK-SECRETS-002: Add typed tests for backend fallback and access error
- TASK-SECRETS-003: Document security boundary ownership
- TASK-SECRETS-004: Implement keychain/env/encrypted file adapters
- TASK-SECRETS-005: Implement rotation/update and invalidation
- TASK-SECRETS-006: Implement safe diagnostics APIs for setup/doctor
- TASK-SECRETS-007: Integrate provider/runtime/CLI secret flows
- TASK-SECRETS-008: Add integration tests for secret lookup precedence
- TASK-SECRETS-009: Emit redacted access telemetry
- TASK-SECRETS-010: Add failure-mode regressions
- TASK-SECRETS-011: Update docs and operator safety guidance
- TASK-SECRETS-012: Pass package and monorepo release gates

TODO only mentions: "In-memory Map with no encryption, No platform-specific storage"

### @agentsy/tools (12 detailed tasks missing)

Package plan tasks not in TODO:

- TASK-TOOLS-001: Stabilize tool definition, schema, and lifecycle event contracts
- TASK-TOOLS-002: Add typed tests for validation and result envelope
- TASK-TOOLS-003: Document ownership boundaries with runtime/plugins/orchestrator
- TASK-TOOLS-004: Implement baseline tool sets (repl/file/shell/web/mcp bridge)
- TASK-TOOLS-005: Implement deterministic error and retry behavior
- TASK-TOOLS-006: Implement capability metadata and registry interfaces
- TASK-TOOLS-007: Integrate runtime approval and guardrail pathways
- TASK-TOOLS-008: Add integration tests for approve/reject/refusal flows
- TASK-TOOLS-009: Emit observability lifecycle traces
- TASK-TOOLS-010: Add regression/performance suites for tool execution
- TASK-TOOLS-011: Align docs/examples and operator safety guidance
- TASK-TOOLS-012: Pass package and monorepo release gates

TODO only mentions: "ToolDefinition interface doesn't exist, REPL tool only placeholder, No file operations"

### @agentsy/context (12 tasks, partially complete in plan but not reflected in TODO)

Package plan tasks (TASK-TOKENS-004 to -006 marked ✅ complete 2026-05-17):

- TASK-TOKENS-007: Integrate runtime/orchestrator enforcement middleware
- TASK-TOKENS-008: Add integration tests for budget rejection/downscoping
- TASK-TOKENS-009: Validate observability/CLI/UI metric wiring
- TASK-TOKENS-010: Add perf/benchmark regressions for accounting
- TASK-TOKENS-011: Update docs/examples and operator budget guidance
- TASK-TOKENS-012: Pass package and monorepo release gates

TODO says: "~30% complete, No cost calculation system, No real token counting"
BUT PLAN SAYS: Tasks 4-6 are COMPLETE with dates 2026-05-17

---

## Section 2: TODO → Package Plans (Missing from Package Plans)

The following content from TODO.txt is NOT captured in package implementation plans:

### Ecosystem Integration Strategy (not in any package plan)

FROM TODO Section ECOSYSTEM ANALYSIS FINDINGS:

- Bundle strategy: models.dev, Honker, AgentFS, mcp-rag-server, Maki
- Conditional packages: tldw_server, mirage, Codeburn, Stagehand, Varlock, Crit
- Local LLM provider support: Ollama, vLLM, LM Studio, Lemonade, Docker Model Runner, Jan, Apfel, node-llama-cpp
- Runner model acquisition: Hugging Face, Ollama, open providers
- Local automodel selection: llmfit, llama-swap
- Token optimization patterns: Caveman, Virtual Sandbox, BLAKE3, Role-based orchestration, Task delegation

These are cross-ecosystem decisions that should be referenced in individual package plans but are currently not.

### Turso + Honker Hybrid Strategy (not in memory package plan)

FROM TODO:

- CRITICAL CONSTRAINT: Turso does NOT support honk extension
- SOLUTION: Local-first coordination with Turso remote sync
- Local Layer (1-5ms latency): Local SQLite with honk extension
- Remote Layer: Turso for cloud sync and backup
- Integration Pattern: Use honker for coordination, Turso for persistence

This critical architecture decision should be in @agentsy/memory IMPLEMENTATION-PLAN.md but isn't.

### Phase 0-2 Completion Claims (not verified in package plans)

FROM TODO Verification Update:

- Phase 0 (token reduction foundation): COMPLETE
- Phase 1 (memory coordination + wiki foundation): COMPLETE
- Phase 2 (Turso sync + backup): COMPLETE

These completion claims need verification against individual package plan task completion status.

### 23 Priority Structure (not in package plans)

TODO organizes work into 26 priorities across 4 phases (Foundation, Integration, Feature, Polish):

- Foundation Phase: types, core, observability, memory, session, secrets, guardrails, testing
- Integration Phase: providers, runtime, orchestrator, retrieval, tools, connectors, mcp
- Feature Phase: prompts, plugins, tokens, ui, types completion, renderers, scripts
- Polish Phase: cli large work package, providers minor, renderers minor, metadata

This sequencing is useful but not reflected in individual package plans.

---

## Section 3: Completion Status Discrepancies

### Critical Discrepancies between TODO vs Package Plans vs Actual Code

| Package           | TODO Claim                                                   | Package Plan Marked                      | Compliance Matrix Actual                 | Discrepancy                                  |
| ----------------- | ------------------------------------------------------------ | ---------------------------------------- | ---------------------------------------- | -------------------------------------------- |
| **runtime**       | "~30% complete, Expected agent runtime got task executor"    | TASK-RUNTIME-001 to -006 ✅ (2026-05-17) | 200%+ compliance (bonus features)        | TODO contradicts plan and actual code        |
| **session**       | "5% complete, In-memory only, no persistence"                | TASK-SESSION-001 to -006 ✅ (2026-05-17) | 60% compliance (some extras beyond plan) | TODO contradicts plan and actual code        |
| **tokens**        | "~30% complete, No cost calculation, No real token counting" | TASK-TOKENS-004 to -006 ✅ (2026-05-17)  | 10% compliance (compression only)        | TODO contradicts plan, plan ahead of actual  |
| **memory**        | "Phase 1-2 COMPLETE" (implies 100%)                          | No completion marks in plan              | 98% compliance (51/52 tasks)             | TODO overclaims, plan lacks verification     |
| **observability** | "5% complete, No OpenTelemetry, No traces"                   | No completion marks                      | 30% compliance (type stubs only)         | TODO matches actual, plan lacks verification |
| **tools**         | "5% complete, ToolDefinition doesn't exist"                  | No completion marks                      | 15% compliance (2 stubs)                 | TODO matches actual, plan lacks verification |
| **secrets**       | "5% complete, In-memory Map only"                            | No completion marks                      | 8% compliance (1 interface)              | TODO matches actual, plan lacks verification |
| **guardrails**    | "23% complete, types only"                                   | No completion marks                      | 12% compliance (2 error classes)         | TODO matches actual, plan lacks verification |
| **orchestrator**  | "~35% complete, No slash commands"                           | No completion marks                      | 40% compliance (4 interfaces)            | TODO matches actual, plan lacks verification |
| **cli**           | "1% complete, No CLI framework"                              | No completion marks                      | 37% compliance (3 commands)              | TODO matches actual, plan lacks verification |

### Root Cause of Discrepancies

1. **Package plans lack verifiable completion markers**: Most package plans show "Completed" column as empty ✅ except for runtime/session/tokens where specific dates (2026-05-17) are recorded. This suggests TODO verification claims were based on different criteria than what's tracked in plans.

2. **TODO priorities estimate completion incorrectly**: TODO shows completion percentages based on priority number estimates rather than actual verified tasks in package plans.

3. **Compliance matrix validates actual code**: The IMPLEMENTATION-COMPLIANCE-MATRIX.md is the authoritative source of truth, showing what's actually implemented via code review, not just ✅ marks.

4. **Package plan task completion not synchronized with verification**: Some packages (runtime, session, tokens) have tasks marked ✅ complete with dates, but these aren't reflected in the compliance matrix verification, suggesting the ✅ marks may not represent fully verified implementation.

---

## Section 4: Recommended Actions

### Immediate Follow-up Required

1. **Update TODO.txt with accurate package plan tasks**: Add the 100+ specific TASK-XXX-XXX tasks from package implementation plans that are currently missing.

2. **Update TODO.txt completion rates to match compliance matrix**:
   - runtime: 200%+ (not 30%)
   - session: 60% (not 5%)
   - tokens: 10% (not 30%)
   - memory: 98% (but not 100%, 1 gap)
   - observability: 30% (not 5%, correct 5% for implementation)
   - tools: 15% (not 5%, correct that it's low)
   - secrets: 8% (matches TODO 5%, roughly correct)
   - guardrails: 12% (matches TODO 23% roughly but showing only types)
   - orchestrator: 40% (matches TODO 35% roughly)
   - cli: 37% (matches TODO 1% - major discrepancy)

3. **Add ecosystem integration decisions to relevant package plans**: Incorporate Turso+Honker strategy, models.dev target, AgentFS target, etc. into specific package plans.

4. **Verify package plan ✅ marks against actual code**: The 2026-05-17 ✅ marks for runtime/session/tokens should be verified against actual implementation to ensure they represent real completion, not just "done enough for phase".

5. **Synchronize completion claims**: Ensure Phase 0-2 completion claims in TODO are backed by actual verified task completion in individual package plans.

### Long-term Structural Improvements

1. **Single source of truth**: Consider making IMPLEMENTATION-COMPLIANCE-MATRIX.md the authoritative tracking document, with individual package plans being the source and TODO being a summary view.

2. **Automated verification**: Implement a script that cross-references package plan task IDs with actual exported functions/classes and auto-completes the ✅ marks when they match.

3. **Governance update**: Add a section to MASTER-IMPLEMENTATION-PLAN.md about how completion should be verified and documented.

---

## Section 5: Summary

**Total Missing Tasks Identified:**

- From package plans missing in TODO: ~120+ specific TASK-XXX-XXX tasks across 10 packages
- From TODO missing in package plans: Ecosystem strategy, Turso+Honker architecture, phase Sequencing

**Critical Discrepancies Identified:**

- 10/10 packages have TODO completion rates that contradict either package plan ✅ marks or compliance matrix verification
- Most likely cause: TODO estimates were based on priority/phase completion guesses rather than verified task completion

**Recommended Path Forward:**

1. Update TODO.txt with package plan tasks and accurate completion rates
2. Verify package plan ✅ marks represent actual code
3. Add cross-package ecosystem decisions to relevant package plans
4. Update MASTER-IMPLEMENTATION-PLAN.md with verified status and synchronization governance
