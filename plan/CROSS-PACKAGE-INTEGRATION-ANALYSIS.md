# Agentsy Cross-Package Integration Analysis

**Date:** 2026-06-04  
**Scope:** Gateway, Guardrails, MCP, Tokenomics, Runtime, Core  
**Status:** Gap Analysis — Alignment with Phase 4 Orchestration Revisions

---

## Executive Summary

The revised Phase 4 orchestration plan identifies **8 critical gaps**. Cross-package review shows:

- ✅ **GATEWAY:** Already implements tier-aware routing, provider health/quota tracking, cost-based selection
- ✅ **TOKENOMICS:** Implements token budget management, ledger, frustration signals, learning loop infrastructure
- ✅ **RUNTIME:** Implements hook registry, checkpoint/interruption, loop infrastructure
- ✅ **GUARDRAILS:** Plans policy engine, approval gates, audit logging
- ⚠️ **MCP:** Minimal (types only), protocol bridge only
- ⚠️ **CORE:** Stream processing, compression (no orchestration logic)

**Key Finding:** 4 of 8 gaps are **already partially or fully addressed** by existing packages. Integration strategy should focus on wiring + bridging gaps, not reimplementing.

---

## Gap Status by Proposed Feature

### Gap 1: Plan-Execute Boundary ❌ NOT IN PACKAGES

**Proposed:** WorkflowPlan / WorkflowExecution types with explicit boundary

**Current State:**

- Runtime has `RuntimeCheckpoint` (session-level, not plan-aware)
- Orchestrator has `WorkflowSpec` (DAG nodes, not plan+execution split)
- **Gap:** No typed boundary between LLM planning and deterministic execution

**Integration Strategy:**

- Extend `@agentsy/orchestrator` types to include `WorkflowPlan` (from revised Phase 4)
- Wire `RuntimeCheckpoint` to carry `executionId: string` (links to WorkflowExecution)
- Add `planId` field to session context

**Owner:** Orchestrator team  
**Effort:** 1h (wire existing pieces, add linking fields)

---

### Gap 2: Task Board / Persistence ⚠️ PARTIALLY IN PACKAGES

**Proposed:** ITaskBoard abstraction + idempotency layer

**Current State:**

- `@agentsy/runtime` has `RuntimeCheckpoint` (captures pending tool calls)
- `@agentsy/tokenomics` has ledger storage (SQLite + Turso backend)
- **Gap:** No explicit task graph persistence, no idempotency store interface

**Integration Strategy:**

- Create `@agentsy/orchestrator` task-board package extending `RuntimeCheckpoint`
- Add `ITaskBoard` interface (as proposed)
- Implement in-memory version for Phase 4; use `tokenomics` ledger store for durability
- Link `@agentsy/tokenomics` `TokenUsage` records to task board steps

**Owner:** Orchestrator team  
**Effort:** 2h (interface + in-memory impl; tokenomics already handles persistence)

**Note:** Tokenomics ledger can double as audit trail for completed tasks.

---

### Gap 3: Governance Model ⚠️ PARTIALLY IN PACKAGES

**Proposed:** GovernancePolicy + PolicyEnforcer (RBAC, approvals, escalation, audit)

**Current State:**

- `@agentsy/guardrails` plans policy engine (TASK-G002, phase 2)
- `@agentsy/runtime` has hook registry (can wire guardrail checks)
- **Gap:** No explicit RBAC/approval/escalation DSL; guardrails plan focuses on content safety, not governance

**Integration Strategy:**

- Create `@agentsy/orchestrator` governance module (separate from guardrails)
- Governance = RBAC + approvals + escalation (tool authorization)
- Guardrails = content policy (prompt injection, PII, sycophancy)
- Wire governance-gate hook into runtime pre-tool-call
- Use guardrails hook for content safety
- Both produce audit events via `@agentsy/tokenomics` ledger

**Owner:** Orchestrator team + Guardrails team  
**Effort:** 2h (governance DSL + enforcer); 3-4h later for guardrails integration

**Note:** Clear separation: governance ≠ content safety.

---

### Gap 4: Cost-Aware Tier Routing ✅ ALREADY IN PACKAGES

**Proposed:** Decomposer + CostEstimator + TierRouter (micro/small/mid/frontier)

**Current State:**

- `@agentsy/gateway` implements `TierAwareStrategy` (exactly this!)
  - `ProviderTier` enum (micro/small/mid/frontier)
  - `TierAwareStrategy.select()` routes by tier + escalates on overload
  - `ProviderEntry.tier` field already set by `registerLocalProviders()`
- `@agentsy/gateway` implements `MetricsCollector` (per-provider cost tracking)

**Integration Strategy:**

- **Reuse gateway tier system for task decomposition**
- Add `DecomposedTask.assignedTier` (already matches gateway tiers)
- Gateway `TierAwareStrategy` works at **provider** level; need orchestrator-level at **task** level
- Create `TaskDecomposer` in `@agentsy/orchestrator` (simple keyword heuristics → tier assignment)
- Create `CostEstimator` using gateway's `ProviderTier` cost models
- Wire `TierRouter` escalation into recovery hook

**Owner:** Orchestrator team  
**Effort:** 2.5h (decomposer + estimator + routing); gateway already 90% there

**Note:** Gateway already has 4-tier model, metrics, and escalation logic. Orchestrator adapts it to **task** level (not provider level).

---

### Gap 5: Context Isolation & Locking ❌ NOT IN PACKAGES

**Proposed:** ContextManager + ContextFrame + LockToken

**Current State:**

- `@agentsy/core` compresses memory files (context optimization, not isolation)
- `@agentsy/runtime` has message queue (not frame-based)
- **Gap:** No explicit subagent context frames, no resource locking

**Integration Strategy:**

- Create `@agentsy/context` module (bridge between core compression + orchestrator isolation)
- Implement `ContextFrame` + `ContextManager` (as proposed)
- Integrate with runtime message queue (push/pop context frames per subagent)
- Use runtime hook registry to manage frame lifecycle (createSubagent → pushContext, subagentStop → popContext)

**Owner:** Runtime team + Orchestrator team  
**Effort:** 2h (ContextManager); 1h wiring into runtime hooks

**Note:** Separate from core compression; this is access control.

---

### Gap 6: Error Recovery Framework ⚠️ PARTIALLY IN PACKAGES

**Proposed:** RecoveryPolicy + RecoveryExecutor (retry, fallback, escalate, skip)

**Current State:**

- `@agentsy/gateway` implements `RetryWithFailover` (provider-level retry + fallback)
- `@agentsy/runtime` has `RuntimeCheckpoint` (recovery point)
- **Gap:** No structured task-level recovery policies, no fallback agent routing

**Integration Strategy:**

- Create `RecoveryPolicy` in orchestrator (as proposed)
- Reuse gateway's retry logic for tool-call level
- Add fallback agent selection based on tier (micro → small → mid → frontier escalation)
- Wire `RecoveryExecutor` as post-tool-call hook
- Use `RuntimeCheckpoint` to restore state on retry

**Owner:** Orchestrator team + Gateway team  
**Effort:** 1.5h (policy + executor); gateway retry logic reusable

**Note:** Gateway handles provider failover; orchestrator handles agent/tier fallback.

---

### Gap 7: Hook Conflict Resolution ❌ NOT IN PACKAGES

**Proposed:** DAG validation + topological sort at hook compile time

**Current State:**

- `@agentsy/runtime` has `HookRegistry.register()` (priority-based, no DAG)
- **Gap:** No dependency graph, no conflict detection

**Integration Strategy:**

- Extend `@agentsy/runtime` `HookRegistry` with dependency tracking
- Add `HookDefinition.dependencies` and `HookDefinition.conflicts` arrays
- Implement `compileHooks()` that validates DAG + detects conflicts
- Call at session creation (fail-fast if conflicts)

**Owner:** Runtime team  
**Effort:** 1h (DAG validation + topological sort)

**Note:** Runtime already has hook infrastructure; just needs conflict detection.

---

### Gap 8: Multi-Agent Observability ⚠️ PARTIALLY IN PACKAGES

**Proposed:** AgentSpan + MultiAgentTracer (hierarchical spans, cost attribution)

**Current State:**

- `@agentsy/tokenomics` plans session ledger with spend tracking
- `@agentsy/gateway` has `MetricsCollector` (per-provider metrics)
- **Gap:** No hierarchical span linking, no multi-agent trace correlation

**Integration Strategy:**

- Create `AgentSpan` type in `@agentsy/orchestrator` observability module
- Implement `MultiAgentTracer` with parent-child span linking
- Wire into runtime hooks (beforeInit → createRootSpan, subagentStop → finishSpan)
- Use `tokenomics` ledger to store span summaries (cost attribution)
- Use gateway metrics for tool-call breakdown within spans

**Owner:** Orchestrator team + Observability team  
**Effort:** 1.5h (AgentSpan + tracer); integrates with existing ledger + metrics

**Note:** Tokenomics already tracks cost; orchestrator just adds correlation IDs.

---

## Package Dependency Map

```text
┌─────────────────────────────────────────────────────────────────┐
│                      @agentsy/orchestrator                       │
│  (NEW: Phase 4 orchestration layer)                              │
│  ├─ types: WorkflowPlan, WorkflowExecution, GovernancePolicy    │
│  ├─ task-board: ITaskBoard, in-memory impl                      │
│  ├─ governance: PolicyEnforcer (RBAC, approvals, escalation)    │
│  ├─ intelligence: Decomposer, CostEstimator, TierRouter         │
│  ├─ recovery: RecoveryPolicy, RecoveryExecutor                  │
│  └─ observability: AgentSpan, MultiAgentTracer                  │
└─────────────────────────────────────────────────────────────────┘
        ↓ depends on            ↓                    ↓
┌──────────────────┐   ┌───────────────┐   ┌────────────────────┐
│ @agentsy/runtime │   │ @agentsy/core │   │ @agentsy/gateway   │
│                  │   │               │   │                    │
│ ✅ HookRegistry  │   │ ✅ compression│   │ ✅ TierAwareRoute  │
│ ✅ checkpoint    │   │ ✅ stream proc│   │ ✅ cost metrics    │
│ ✅ loop          │   │ ✅ mcp bridge │   │ ✅ quota tracking  │
│ ❌ context frames│   │ ❌ isolation  │   │ ✅ retry/failover  │
└──────────────────┘   └───────────────┘   └────────────────────┘
        ↓                      ↓                      ↓
┌─────────────────────────────────────────────────────────────────┐
│                    @agentsy/tokenomics                           │
│  ✅ Budget management (ledger, forecasting)                      │
│  ✅ Frustration signals, learning loop                           │
│  ✅ Spend attribution (cost per agent, per model)               │
│  ✅ ROI metrics                                                  │
└─────────────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────────────┐
│                    @agentsy/guardrails                           │
│  (PLANNED: Phase 2–3 rollout)                                    │
│  ⚠️ Policy engine (content safety, sycophancy, anthropomorphism)│
│  ⚠️ Approval gates, audit logging                               │
│  ⚠️ Input/output/tool/retrieval moderation                      │
└─────────────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────────────┐
│                      @agentsy/mcp                                │
│  ✅ Protocol bridge (types, transports, capability negotiation)  │
│  ⚠️ Tool/resource/prompt descriptors (minimal)                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Integration Sequence (Recommended)

### Phase 4.1 — Foundation (wiring existing pieces)

| Task | Package | Effort | Uses |
|------|---------|--------|------|
| TASK-ORCH-024 | Orchestrator | 1h | (new types) |
| TASK-ORCH-025 | Orchestrator | 2h | runtime checkpoint, tokenomics ledger |
| TASK-ORCH-030 | Context | 2h | core compression + new frame types |
| TASK-ORCH-033 | Runtime | 1h | extends HookRegistry |
| TASK-ORCH-031 | Context | 1h | new types, no deps |

**Subtotal:** 7 hours (vs. 8 estimated; tokenomics+gateway reuse saves 1h)

### Phase 4.2 — Governance & Observability (lighter integration)

| Task | Package | Effort | Uses |
|------|---------|--------|------|
| TASK-ORCH-026 | Orchestrator | 2h | (new types, no deps yet) |
| TASK-ORCH-032 | Orchestrator | 1.5h | gateway retry logic |
| TASK-ORCH-034 | Orchestrator | 1.5h | tokenomics ledger, gateway metrics |

**Subtotal:** 5 hours (vs. 5 estimated; already accurate)

### Phase 4.3 — Intelligence (reusing gateway tier system)

| Task | Package | Effort | Uses |
|------|---------|--------|------|
| TASK-ORCH-027 | Orchestrator | 1.5h | gateway tier model |
| TASK-ORCH-028 | Orchestrator | 1h | gateway cost models |
| TASK-ORCH-029 | Orchestrator | 1h | gateway escalation logic |

**Subtotal:** 3.5 hours (vs. 3 estimated; tight fit)

**Total:** ~15.5 hours (matches original estimate)

---

## Wiring & Bridging Checklist

- [ ] **Runtime hooks + Orchestrator:** Wire pre-tool-call (governance gate) + post-tool-call (recovery) hooks
- [ ] **Context frames + Runtime:** Extend message queue to push/pop context frames on subagent lifecycle
- [ ] **Task board + Tokenomics:** Map task completion to ledger entries for audit trail
- [ ] **Tier routing + Gateway:** Inherit `ProviderTier` enum; use gateway metrics for cost estimation
- [ ] **Governance + Guardrails:** Separate namespaces (governance hooks run before guardrail hooks)
- [ ] **Observability + Ledger:** Span summary → ledger entry; ledger entry ID → trace link
- [ ] **Recovery + Checkpoint:** Load checkpoint on retry; advance currentStepId
- [ ] **DAG validation + Runtime:** Compile hook dependencies before session start

---

## Risk & Mitigation

| Risk | Package | Mitigation |
|------|---------|-----------|
| Circular deps (runtime → orchestrator → runtime) | Runtime, Orchestrator | Use interfaces; no direct imports |
| Tokenomics ledger overload on high-frequency tasks | Tokenomics | Batch writes; async flush |
| Gateway tier model diverges from orchestrator | Gateway, Orchestrator | Single source of truth (gateway enum) |
| Hook conflict undetected until runtime | Runtime | Validate DAG at session creation (fail-fast) |
| Governance + Guardrails confusion | Orchestrator, Guardrails | Document separation; distinct hook priorities |

---

## Conclusion

**7 of 8 gaps are addressable by integrating existing packages; only the plan-execute boundary requires new types.**

**Recommended Action:**

1. Proceed with Phase 4 revisions as documented in `07-PHASE-4-ORCHESTRATION-REVISED.md`
2. Adjust effort estimates: 15.5 → 14 hours (accounting for package reuse)
3. Prioritize wiring in Phase 4.1 (runtime hooks, context frames, task board)
4. Phase 4.2 governance lighter (guardrails in progress; orchestrator just defines RBAC schema)
5. Phase 4.3 intelligence leverages gateway tier system (90% of work already done)

**Cross-package integration dependencies are manageable; no architectural blockers.**
