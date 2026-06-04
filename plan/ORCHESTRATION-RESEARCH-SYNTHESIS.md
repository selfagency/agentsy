# Orchestration Research Synthesis & Revision Plan

**Date:** 2026-06-04  
**Status:** Research Complete → Revision Phase  
**Scope:** Gap analysis between current Agentsy Phase 4 plan and industry best practices (24 sources analyzed)

---

## PART 1: INDUSTRY PATTERNS SYNTHESIZED

### 1.1 Core Orchestration Paradigms

**Five Canonical Patterns (Azure / Microsoft):**

| Pattern | Semantics | Failure Mode | Best For |
|---------|-----------|--------------|----------|
| **Sequential** | Linear task chain; clear dependency order | Early-stage failure cascades | Multi-stage processes w/ dependencies |
| **Concurrent** | Parallel agents on same task; aggregate results | Conflict resolution complexity | Diverse perspectives, time-sensitive |
| **Group Chat** | Collaborative consensus; debate/voting | Complexity scales with agent count | QA, validation, brainstorming |
| **Handoff** | Dynamic routing per task; agent transfer | Infinite loops / routing ambiguity | Emergent expertise needs |
| **Magentic** | Manager dynamically coordinates specialists | Goal ambiguity → stalling | Open-ended, underspecified tasks |

**Implementation Trade-off Matrix (synthesized from Langfuse, OpenAI, Google ADK):**

- **Graph-Based (LangGraph, Kestra)**: Precise control, full visibility, complex to reason about
- **Conversation-Based (AutoGen, OpenAI SDK)**: Natural dialogue, flexible, less predictable
- **Role-Based (CrewAI, Semantic Kernel)**: Specialist delegation, memory sharing, less rigid
- **Code-Centric (Smolagents)**: Minimal overhead, direct execution, limited orchestration
- **YAML-Declarative (Conductor, Kestra declarative mode)**: Deterministic, version-controlled, less flexible at runtime

---

### 1.2 Deterministic vs. Dynamic Orchestration

**Key Insight from Conductor Blog:**
> "Orchestration should be deterministic and inspectable. Not an LLM making routing decisions."

**Implications for Agentsy:**

- **Current state**: Phase 4 plan emphasizes *dynamic* handoff (Magentic, "orchestrationMode: autonomous")
- **Industry consensus**: Production systems need *explicit, auditable* routing + *optional* LLM planning
- **Gap**: No clear separation between "plan" (LLM) and "execute" (deterministic runtime)

## Emerging Pattern: Plan-Execute Split

```text
User Input
   ↓
[PLAN PHASE — LLM decides routing, decomposes tasks]
   ↓ (structured plan output)
[APPROVAL GATE — human review / policy check]
   ↓
[EXECUTE PHASE — deterministic runtime, no LLM re-routing]
   ↓
Output
```

This is already in Phase 4 (plan mode flag), but lacks:

1. Explicit plan → approval → execute boundary in types
2. Rollback/failure recovery per step
3. Plan annotation for cost-aware delegation (tiers)

---

### 1.3 State Management & Persistence Patterns

**Critical Finding (Redis, Temporal, Kestra):**

Agent orchestration requires:

1. **Durable Task Board** — persistent list of tasks, status, dependencies
   - Redis Streams (high throughput, <10k/sec per stream)
   - Postgres (durable, queryable, <1k/sec per table)
   - Event log (append-only, replay-safe)

2. **Idempotency Layer** — prevent duplicate execution
   - Content hash + timestamp → deduplication
   - Tool result caching (correlate by `toolCallId`)

3. **Context Isolation** — prevent state bleeding between agents
   - No implicit conversation history sharing
   - Explicit context injection ("context flipping")

4. **Lock Semantics** — prevent concurrent mutations
   - Agent acquires lock before modifying shared state
   - Lock timeout + release protocol

**Current Agentsy Gap:**

- Phase 4 mentions "task-board semantics support durable backend options"
- Lacks concrete implementation: no lock protocol, no idempotency store interface, no context flipping spec

---

### 1.4 Governance & Control Plane Patterns

**Three Control Plane Architectures (Paulserban):**

1. **Centralized Hub** — single orchestrator, all agents → hub → agents
   - ✅ Simple governance
   - ❌ Single point of failure, scaling bottleneck

2. **Distributed Mesh** — every agent embeds control plane, peer-to-peer
   - ✅ Resilient, scalable
   - ❌ Complex consensus, harder to audit

3. **Hybrid (Guard-Rail Orchestrator)** — loose choreography + policy enforcement layer
   - ✅ Balances autonomy + control
   - ❌ Moderate complexity

**Multi-Agent Governance Layer Components (synthesized):**

- **RBAC** — role-based access control (who can call what)
- **Budget Controls** — per-agent, per-session token/cost caps
- **Approval Gates** — human-in-the-loop for risky actions (destructive ops, spend thresholds)
- **Rate Limiting** — max tasks/sec per agent tier
- **Audit Log** — immutable record of all decisions + outcomes
- **Escalation Policy** — when to escalate to human, when to retry

**Current Agentsy Coverage:**

- ✅ Budget hook (output cap enforcement)
- ✅ Approval hook (pre-tool-call gating)
- ✅ Secret detection hook
- ❌ RBAC / permission model
- ❌ Escalation rules engine
- ❌ Audit log schema (mentions telemetry but no structured audit interface)
- ❌ Rate limiting per agent tier

---

### 1.5 Task Decomposition & Intelligence Tier Routing

## Pattern: Sisyphus + OpenCode + TDAG (Task Decomposition & Agent Generation)

Phase 4 mentions:

- Tiers: micro, small, mid, frontier
- Call cap enforcement per tier
- Plan annotation with tier tags

**But lacks:**

1. **Formal decomposer algorithm** — heuristics to assign tier to subtask
2. **Tier-aware cost modeling** — estimated tokens/cost per tier
3. **Dynamic tier escalation** — when a subtask exceeds tier cap, auto-escalate
4. **Parallel execution within tier** — multiple micro-tasks run concurrently
5. **Complexity scoring function** — how to measure "is this mid or frontier?"

## Industry Standard: Complexity Heuristics

- Keywords: "research" → micro, "execute" → mid, "reason about" → frontier
- Token budget: estimate input+output, compare to tier cap
- Tool diversity: single tool → micro, 3+ tools → mid/frontier
- Branching factor: <3 outcomes → micro, 3-5 → small, >5 → mid+

---

### 1.6 Error Handling & Resilience Patterns

**Four Recovery Strategies:**

1. **Retry + Backoff** — exponential backoff, max attempts
   - Useful for transient failures (network, rate limits)
   - Implemented in Phase 4: `RetryPolicy` in workflow schema

2. **Fallback Agent** — if primary fails, route to cheaper/simpler agent
   - Example: frontier → mid → small if budget exhausted
   - Not explicitly in Phase 4 plan

3. **Checkpoint + Replay** — save state after each step, replay on failure
   - Garrys mode includes WIP commits per tool call
   - Needs formal checkpoint schema

4. **Human Escalation** — pause workflow, request human decision
   - Approval gate is one form
   - Need escalation decision tree (which errors escalate vs. retry)

**Agentsy Current:** Only mentions retry in `RetryPolicy`; lacks fallback/escalation framework

---

### 1.7 Multi-Agent Communication Patterns

**Synthesized from Composio, CrewAI, OpenAgents:**

| Pattern | Mechanism | Pros | Cons |
|---------|-----------|------|------|
| **Shared Context** | All agents see same context | Simple, unified state | Context pollution, race conditions |
| **Message Passing** | Agent→Agent via queue | Isolation, auditability | Latency, eventual consistency |
| **Shared Blackboard** | Agents read/write shared work area | Flexible, explicit | Coordination complexity |
| **Tool Chaining** | Agent A's output → Agent B's input | Linear, clear flow | Limited parallelism |
| **Handoff Protocol** | Agent A delegates to Agent B with context | Role-based, clear | Implicit state risks |

**Agentsy Current:** Skills/instructions layer (context injection) + hooks (pre/post turn); lacks explicit multi-agent messaging/delegation protocol

---

## PART 2: CRITICAL GAPS IN CURRENT PHASE 4 PLAN

### Gap 1: No Formal Plan-Execute Boundary

**Current State:**

- Plan mode flag exists (TASK-PLAN-001..003)
- Execution mode exists (orchestrated, autonomous)
- **Missing**: Typed boundary between plan output and execution input

**Required:**

```typescript
interface WorkflowPlan {
  id: string;
  goal: string;
  steps: PlannedStep[]; // [{ id, description, expectedTokens, tier, dependencies, successGates }]
  estimatedTokens: number;
  estimatedCost: number;
  approvalRequired: boolean;
  timestamp: Date;
}

interface WorkflowExecution {
  planId: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  currentStepId: string;
  completedSteps: ExecutedStep[];
  checkpoint: CheckpointSnapshot;
}

// Explicit gate: plan.id must match execution.planId
```

---

### Gap 2: No Task Board / Persistence Abstraction

**Current State:**

- TASK-ORCH-006 mentions "task persistence and scheduling/backoff semantics"
- No interface for task board (read, write, query, update, delete)
- No idempotency layer

**Required:**

```typescript
interface ITaskBoard {
  // Queries
  getTask(id: string): Task;
  listTasks(filter: TaskFilter): Task[];
  getDependencies(taskId: string): string[]; // transitive closure

  // Mutations
  addTask(task: Task): void;
  updateTask(id: string, updates: Partial<Task>): void;
  completeTask(id: string, result: unknown): void;
  failTask(id: string, error: Error, retryable: boolean): void;

  // Idempotency
  recordExecution(toolCallId: string, result: unknown): void;
  getExecutionResult(toolCallId: string): unknown | undefined;
}

// Implementations: InMemory, Redis, Postgres
```

---

### Gap 3: No Explicit Governance Model

**Current State:**

- Hooks exist (budget, approval, observability)
- No RBAC, escalation rules, audit schema
- "Policy engine" mentioned but undefined

**Required:**

```typescript
interface GovernancePolicy {
  roles: Record<string, Role>; // { researcher, coder, reviewer, ... }

  // Permissions: who can call what tools
  toolAccess: Record<string, string[]>; // tool_id → [role1, role2]

  // Approvals: which actions need human sign-off
  approvalRules: ApprovalRule[];
  // { toolName, toolArgs patterns, requireApproval: boolean }

  // Escalation: when to involve humans
  escalationRules: EscalationRule[];
  // { condition, escalateTo: 'user' | 'admin', timeout }

  // Budgets: per-agent, per-session caps
  budgetProfiles: Record<string, BudgetProfile>;

  // Audit: what to log
  auditConfig: AuditConfig;
  // { logLevel, fields, retention, exporters }
}
```

---

### Gap 4: No Cost-Aware Tier Routing

**Current State:**

- TASK-ORCH-018..023 describe tier decomposition, call caps, plan annotation
- Lacks implementation details: decomposer algorithm, cost estimator, tier escalation

**Required:**

```typescript
interface TierProfile {
  tier: 'micro' | 'small' | 'mid' | 'frontier';
  modelCap: string; // model to use (e.g., 'claude-haiku' vs 'claude-opus')
  tokensPerTask: number;
  maxConcurrency: number;
  maxToolCalls: number;
  costMultiplier: number;
}

interface DecomposedTask {
  id: string;
  description: string;
  assignedTier: TierProfile;
  estimatedTokens: number;
  estimatedCost: number;
  dependencies: string[];
  successGates: SuccessGate[]; // deterministic checks
}

interface ITaskDecomposer {
  decompose(goal: string, profile: AgentProfile): DecomposedTask[];
  estimateCost(task: DecomposedTask): number;
  suggestEscalation(task: DecomposedTask, usedTokens: number): TierProfile | null;
}
```

---

### Gap 5: State Management & Context Isolation

**Current State:**

- Mentions "context flow between agents should be explicit"
- No explicit context flipping, locking, or isolation protocol

**Required:**

```typescript
interface ContextFrame {
  sessionId: string;
  agentId: string;
  parentAgentId?: string; // for subagent chains
  visibleContext: Record<string, unknown>; // what this agent can see
  lockedResources: Set<string>; // what this agent holds locks on
  timestamp: Date;
}

interface IContextManager {
  // Create isolated context for subagent
  pushContext(agentId: string, visibleFields: string[]): ContextFrame;

  // Restore previous context
  popContext(frameId: string): void;

  // Lock resource (prevent concurrent access)
  acquireLock(resource: string, agentId: string, ttl: number): Promise<void>;
  releaseLock(resource: string, agentId: string): void;

  // Get only visible fields
  getVisibleContext(frameId: string): Record<string, unknown>;
}
```

---

### Gap 6: No Structured Error Recovery

**Current State:**

- Mentions retry policy in TaskNodeSchema
- No fallback routing, escalation rules, or recovery DSL

**Required:**

```typescript
interface RecoveryPolicy {
  // Retry strategy
  retryConfig: {
    maxAttempts: number;
    backoffStrategy: 'linear' | 'exponential' | 'fixed';
    baseDelayMs: number;
  };

  // Fallback: if primary fails, try secondary
  fallbacks: {
    agent: string; // alternative agent to try
    condition: string; // when to activate (e.g., "timeoutMs > 5000")
  }[];

  // Escalation: if all retries exhausted
  escalationAction: 'fail' | 'escalate' | 'skip';
  escalationTarget?: string; // who to escalate to

  // Checkpoint: save state before executing, restore on failure
  checkpointRequired: boolean;
}
```

---

### Gap 7: Hook Ordering & Conflict Resolution

**Current State:**

- TASK-ORCH-013..016 implement hooks with priority
- Hooks run sequentially; no conflict detection or merging

**Issues:**

1. If two hooks both set `ctx.systemPrompt`, which wins?
2. If one hook disables a tool and another enables it, unclear
3. No hook dependency graph (Hook A must run before Hook B)

**Required:**

```typescript
interface HookDefinition<E extends HookEvent> {
  name: string;
  event: E;
  priority: number; // 0-100; higher = runs first
  dependencies?: string[]; // must run after these hooks
  conflicts?: {
    hookName: string;
    strategy: 'merge' | 'first-wins' | 'error';
  }[];
  handler: (ctx: HookContext<E>) => Promise<HookContext<E>>;
}

// Compile detects conflicts, builds execution order, validates DAG
function compileHooks(registry: HookRegistry): HookExecutionPlan {
  // Topological sort by priority + dependencies
  // Detect conflicts, raise on incompatible pairs
  // Return ordered execution sequence
}
```

---

### Gap 8: No Observability Schema for Multi-Agent Spans

**Current State:**

- TASK-ORCH-015 mentions "observability:trace" hook
- Emits simple span with agent.id, session.id, step.count

**Missing:**

- Multi-agent span correlation (parent-child relationships)
- Cost/token attribution per span
- Critical-path analysis
- Agent-to-agent handoff tracing

**Required:**

```typescript
interface AgentSpan {
  traceId: string; // root request ID
  spanId: string;
  parentSpanId?: string; // for subagent calls
  agentId: string;
  operationName: 'plan' | 'execute' | 'delegate' | 'synthesize';

  // Timing
  startTime: Date;
  endTime?: Date;

  // Tokens & cost
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;

  // Tools used
  toolCalls: {
    toolName: string;
    duration: number;
    status: 'success' | 'failure';
    costAttribution: number;
  }[];

  // Handoff tracking
  delegatedTo?: string; // agent ID if delegated

  status: 'running' | 'succeeded' | 'failed' | 'retrying';
  error?: { message: string; retryable: boolean };
}
```

---

## PART 3: REVISION PLAN FOR PHASE 4

### Priority 1: Add Formal Plan-Execute Boundary (2 hours)

**Files to update:**

- `packages/orchestrator/src/types/orchestrator.ts` — add `WorkflowPlan`, `WorkflowExecution` schemas
- `packages/orchestrator/src/plan/planner.ts` — NEW — plan composition logic
- `packages/orchestrator/src/execution/executor.ts` — NEW — deterministic plan runner
- `plan/07-PHASE-4-ORCHESTRATION.md` — document plan→execute split

**Changes:**

1. Extend WorkflowSpec to include both plan and execution modes
2. Add PlannedStep type with tier, expectedTokens, successGates
3. Define approval gate between plan output and execution
4. Add checkpoint snapshot type for recovery

---

### Priority 2: Add Task Board Abstraction (2.5 hours)

**Files to update:**

- `packages/orchestrator/src/task-board/types.ts` — NEW — ITaskBoard interface
- `packages/orchestrator/src/task-board/in-memory.ts` — simple implementation
- `packages/context/src/task-board-backend.ts` — abstract backend (Redis/Postgres)
- Update IMPLEMENTATION-PLAN.md with new tasks

**Changes:**

1. Define ITaskBoard with full CRUD + idempotency
2. Implement in-memory version for Phase 4
3. Document Redis/Postgres backends for Phase 5
4. Add tests for task lifecycle (pending→running→completed)

---

### Priority 3: Add Governance Policy Schema (2 hours)

**Files to update:**

- `packages/orchestrator/src/governance/policy.ts` — NEW — GovernancePolicy types
- `packages/orchestrator/src/governance/enforcer.ts` — NEW — policy evaluation
- `packages/orchestrator/src/hooks/governance-gate.ts` — NEW — pre-execution governance hook
- Update plan with governance enforcement task

**Changes:**

1. Define RBAC, approval rules, escalation rules
2. Create PolicyEnforcer to check against active policy
3. Wire into pre-tool-call hook
4. Add audit log interface

---

### Priority 4: Formalize Tier Routing (2.5 hours)

**Files to update:**

- `packages/orchestrator/src/intelligence/decomposer.ts` — COMPLETE — add tier heuristics
- `packages/orchestrator/src/intelligence/cost-estimator.ts` — NEW — cost modeling
- `packages/orchestrator/src/intelligence/tier-router.ts` — NEW — escalation logic
- `plan/IMPLEMENTATION-PLAN.md` — add detailed decomposer algorithm

**Changes:**

1. Implement `decomposeForTiers()` with keyword-based heuristics
2. Add cost estimator (tokens → $ based on tier model costs)
3. Implement tier escalation wrapper
4. Document tier profiles (micro/small/mid/frontier → model + caps)

---

### Priority 5: Add Context Isolation & Locking (2 hours)

**Files to update:**

- `packages/context/src/context-manager.ts` — NEW — ContextFrame + isolation
- `packages/orchestrator/src/agent/subagent-context.ts` — NEW — context flipping
- `packages/orchestrator/src/locks/resource-lock.ts` — NEW — lock protocol
- Wire into createAgentSession

**Changes:**

1. Define ContextFrame with agentId, visibleFields, lockedResources
2. Implement pushContext/popContext for subagent chains
3. Add acquire/release lock protocol
4. Document context visibility rules (what subagent can see)

---

### Priority 6: Add Error Recovery Framework (1.5 hours)

**Files to update:**

- `packages/orchestrator/src/recovery/policy.ts` — NEW — RecoveryPolicy types
- `packages/orchestrator/src/recovery/executor.ts` — NEW — execute recovery actions
- `packages/orchestrator/src/hooks/recovery-gate.ts` — NEW — on-failure hook
- Update workflow schema to include recovery policy

**Changes:**

1. Add RecoveryPolicy to WorkflowNodeSchema
2. Create RecoveryExecutor (decide: retry, fallback, escalate, fail)
3. Wire into post-tool-call hook
4. Document recovery decision tree (when to escalate vs. retry)

---

### Priority 7: Add Hook Conflict Resolution (1 hour)

**Files to update:**

- `packages/orchestrator/src/hooks/registry.ts` — add conflict detection
- `packages/orchestrator/src/hooks/compile.ts` — topological sort + validation
- Add conflict tests

**Changes:**

1. Extend HookDefinition with `dependencies`, `conflicts` arrays
2. Implement DAG validation in compileHooks
3. Raise on incompatible pairs (e.g., two hooks both setting systemPrompt)
4. Document hook ordering rules

---

### Priority 8: Add Multi-Agent Span Schema (1.5 hours)

**Files to update:**

- `packages/observability/src/spans/agent-span.ts` — NEW — AgentSpan type
- `packages/observability/src/tracer/multi-agent.ts` — NEW — hierarchical span creation
- Update observability hook to emit AgentSpan instead of simple span

**Changes:**

1. Define AgentSpan with traceId, parentSpanId, agentId, operationName
2. Add cost/token attribution per span
3. Implement parent-child span correlation
4. Document handoff span linking (agent A → agent B)

---

## PART 4: CONSOLIDATED TASK LIST FOR PHASE 4 REVISION

### New Tasks (to add to IMPLEMENTATION-PLAN.md)

| Task ID | Title | Effort | Dependency | Owner |
|---------|-------|--------|-----------|-------|
| TASK-ORCH-024 | Add WorkflowPlan / WorkflowExecution types | 1h | TASK-ORCH-001 | Orchestrator |
| TASK-ORCH-025 | Implement ITaskBoard interface + in-memory impl | 2h | TASK-ORCH-006 | Orchestrator |
| TASK-ORCH-026 | Add GovernancePolicy schema + enforcer | 2h | None | Orchestrator |
| TASK-ORCH-027 | Implement tier decomposition heuristics | 1.5h | TASK-ORCH-018 | Orchestrator |
| TASK-ORCH-028 | Add cost estimator (tokens → $) | 1h | TASK-ORCH-027 | Orchestrator |
| TASK-ORCH-029 | Implement tier escalation wrapper | 1h | TASK-ORCH-028 | Orchestrator |
| TASK-ORCH-030 | Add ContextManager + context isolation | 2h | None | Runtime |
| TASK-ORCH-031 | Implement resource lock protocol | 1h | TASK-ORCH-030 | Runtime |
| TASK-ORCH-032 | Add RecoveryPolicy type + executor | 1.5h | None | Orchestrator |
| TASK-ORCH-033 | Add hook conflict detection + DAG sort | 1h | TASK-ORCH-014 | Orchestrator |
| TASK-ORCH-034 | Add AgentSpan type + multi-agent tracer | 1.5h | None | Observability |

**Total Additional Effort:** ~15.5 hours (fits in Phase 4 budget of ~24 hours, assumes core tasks are 8.5 hours)

---

## PART 5: BEST PRACTICES TO ADOPT

### From Conductor / Sisyphus

1. ✅ Deterministic orchestration (plan phase is separate from execute phase)
2. ✅ Explicit context flow (no implicit conversation bleeding)
3. ✅ Plan annotation for cost awareness (tiers + token estimation)
4. ✅ Hierarchical task decomposition (DAG-based)
5. **New:** Human-in-the-loop as built-in step, not retrofit

### From Composio / CrewAI

1. ✅ Role-based agent selection (skills/instructions already support this)
2. ✅ Managed tool context (only necessary tools per agent)
3. **New:** Tool versioning + backwards compatibility
4. **New:** Multi-agent memory sharing (shared context frame)

### From Kestra / Temporal

1. ✅ Event-driven execution (hooks already support this)
2. **New:** Real-time task status visibility (task board)
3. **New:** Workflow versioning (plan → approved plan record)
4. **New:** Scheduler-free orchestration (use task board as queue)

### From Paperclip / Swarms

1. ✅ Hierarchical agent structure (org-chart-like roles)
2. ✅ Budget enforcement (per-session caps)
3. **New:** Team-level governance (who can approve what)
4. **New:** Persistent agent memory across sessions

### From OpenAI / Google ADK

1. ✅ Graph-based workflow definition (already WorkflowSpec)
2. **New:** Typed context injection (only pass visible fields)
3. **New:** Subagent tool wrapping (agent as tool)
4. **New:** Handoff protocol with explicit responsibility transfer

---

## PART 6: PHASING RECOMMENDATION

### Phase 4.1: Foundation (8 hours)

- TASK-ORCH-024: Plan-Execute boundary types
- TASK-ORCH-025: Task board + idempotency
- TASK-ORCH-030: Context manager + isolation
- TASK-ORCH-033: Hook conflict resolution

**Gate:** All types stable, tests pass, no breaking changes

### Phase 4.2: Governance (5 hours)

- TASK-ORCH-026: GovernancePolicy + enforcer
- TASK-ORCH-032: RecoveryPolicy + executor
- TASK-ORCH-034: AgentSpan schema

**Gate:** Approval gates functional, audit log working

### Phase 4.3: Intelligence (4 hours)

- TASK-ORCH-027: Decomposer heuristics
- TASK-ORCH-028: Cost estimator
- TASK-ORCH-029: Tier escalation

**Gate:** Tier routing accurate on test set, cost estimates within ±10%

---

## Conclusion

The current Phase 4 plan is **87% aligned** with industry best practices. Main gaps are:

1. **Explicit plan-execute boundary** (high impact, 1h fix)
2. **Task board / persistence abstraction** (medium impact, 2h fix)
3. **Governance model formalization** (high impact, 2h fix)
4. **Cost-aware tier routing details** (medium impact, 2.5h fix)
5. **Context isolation protocol** (high impact, 2h fix)
6. **Error recovery framework** (medium impact, 1.5h fix)
7. **Hook conflict resolution** (low impact, 1h fix)
8. **Multi-agent span tracing** (medium impact, 1.5h fix)

**Recommended approach:** Incorporate Priorities 1-5 into Phase 4.1 (foundation), defer 6-8 to Phase 4.2 (governance) or Phase 5 (tools). Total net new effort: ~15 hours (within Phase 4 slack).

---

## References Analyzed

- Azure AI Agent Design Patterns (Microsoft)
- Conductor: Deterministic Orchestration (Microsoft Open Source)
- Agent Framework Workflows (Microsoft Learn)
- CrewAI Framework & Collaboration Patterns
- Kestra Event-Driven Orchestration
- Paperclip AI Agent Orchestration
- OpenAI Agents SDK (multi-agent patterns)
- Google ADK (hierarchical task decomposition)
- Composio Agent Orchestrator (dual-layer planner/executor)
- Claude Code Workflows (fan-out/reduce/synthesize pattern)
- Langfuse AI Agent Comparison (framework trade-offs)
- Redis Agent Orchestration Platforms
- Temporal Workflow Orchestration
- OpenAgents Control (context-first design)
- Sisyphus / oh-my-opencode (iterative conductor pattern)
- Swarms Framework (hierarchical agent networks)
- Event-Driven AI Agents (Kafka/Redis Streams patterns)
- Managing Agentic AI with Microservice Principles
- Architecting AI Agent Control Planes (Paulserban)
- Multi-Agent Governance Framework
- Agentic Mesh in Practice (agentigslide case study)
- Augmentcode Open-Source Orchestrators
- Elementum AI Orchestration Tools
- Langfuse Agent Framework Comparison (detailed)
