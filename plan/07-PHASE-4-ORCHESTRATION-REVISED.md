# Phase 4 — Orchestration (REVISED — Gap Addressed)

**Effort:** ~24 hours (8h core + 16h gaps)  
**Milestone:** Gate before autonomous tool usage; approval path + policy engine complete  
**Packages:** `@agentsy/orchestrator`, `@agentsy/plugins`, `@agentsy/runtime`, `@agentsy/prompts`, `@agentsy/context`, `@agentsy/secrets`, `@agentsy/renderers`, `@agentsy/cli`  
**Gate:** All hooks, plan mode, plugin security, agent/skill commands, governance model, task board, context isolation complete  
**Next:** Phase 5

---

## Status — 2026-06-12 Code Review

**Completion: ~85% — Core shipped, observability & CLI wiring incomplete**

### ✅ FULLY IMPLEMENTED & TESTED (20 test files, 199 tests, ALL PASSING)
- ✅ Hook registry + DAG compile (topological sort, cycle detection, conflict resolution) — 9 tests pass
- ✅ Context isolation + resource locking (ContextManager with pushContext/popContext/acquireLock/releaseLock) — 15 tests pass
- ✅ Governance policy engine (PolicyEnforcer, condition evaluation, approval/escalate/deny actions) — 12 tests pass
- ✅ Task board with DAG validation + idempotency (InMemoryTaskBoard, full lifecycle) — 14 tests pass
- ✅ Plan types (WorkflowPlan, WorkflowExecution, PlannedStep, SuccessGate) — 16 tests pass
- ✅ Recovery framework (RetryPolicy, RecoveryExecutor, fallback + escalation + skip strategies) — 9 tests pass
- ✅ Recovery state tracking (CircuitBreakerSet, HealthProbe, ModelFailover, RateLimitExceedError) — 30+ tests pass
- ✅ Task decomposition (TaskDecomposer with tier scoring via keyword/token heuristics) — 14 tests pass
- ✅ Cost estimation (CostEstimator with tier-based cost models: micro/small/mid/frontier) — 7 tests pass
- ✅ Tier routing (TierRouter with escalation policy + budget-aware downgrading) — 9 tests pass
- ✅ Agent loop creation (createAgentLoop with step execution, context management) — 34 tests pass
- ✅ Agent registry (AgentRegistry with list/get/discover) — 3 tests pass
- ✅ Scheduler foundation (basic scheduling, task tracking) — 7 tests pass
- ✅ Orchestrator-loop integration (basic loop execution) — 1 test passes

### ⏳ INCOMPLETE
- **❌ AgentSpan + MultiAgentTracer** (TASK-ORCH-034)
  - `AgentSpan` type defined in `types/plan.ts` but `MultiAgentTracer` class never built
  - Impact: Multi-agent observability missing (tracing parent-child relationships)
  - Fix: Implement `MultiAgentTracer` class (1.5h)
  
- **⚠️ Agent CLI wiring incomplete**
  - `createAgentSession` exists but not fully integrated into CLI `/agent` commands
  - Agent discovery/loader structure exists but no file-based agent discovery
  - Impact: Phase 4 calls for `/agent <name>` and `/skills list` — partially missing
  - Fix: Wire into CLI chat command, implement agent file loader (1h)

### ✅ DOCUMENTATION & EXPORTS
- ✅ Barrel exports in `src/index.ts` — all major classes exported

### STATUS: ~85% SHIPPED — Core orchestration complete, observability tracing + CLI wiring remain

---

## Overview

Wire full orchestration control plane with explicit plan-execute boundary, task durability, governance enforcement, model-tier routing, and replica-aware load balancing. This revision incorporates findings from 24+ industry sources (Conductor, Sisyphus, CrewAI, Composio, Kestra, OpenAI SDK, etc.) addressing 8 critical gaps in the original plan.

**Key Additions (Revised):**

- ✅ Formal plan-execute boundary with typed contracts
- ✅ Task board abstraction with idempotency
- ✅ Governance policy model (RBAC, approvals, escalation, audit)
- ✅ Model-tier and replica-aware routing
- ✅ Local-first routing for micro/small tasks
- ✅ Context isolation & resource locking protocol
- ✅ Structured error recovery framework
- ✅ Hook conflict resolution with DAG validation
- ✅ Multi-agent span schema for observability

---

## PART A: CORE ORCHESTRATION (UNCHANGED FROM ORIGINAL)

### 1. Hook Registry & Agent Session (Orchestrator)

**STATUS:** Same as original (TASK-ORCH-013..016)

All built-in hooks implemented as specified. See `plan/07-PHASE-4-ORCHESTRATION.md` sections 1-2 for details.

- ✅ Memory pre/post-turn hooks
- ✅ Skills/instructions/budget/approval hooks
- ✅ Observability hook
- ✅ Plan mode flag
- ✅ Skills/instructions/agents discovery

---

### 2. Skills, Instructions, Agents Discovery

**STATUS:** Same as original (TASK-SIA-001..010)

Full discovery implementation with precedence rules. See original plan sections 4-5.

- ✅ SkillDiscoverer + SkillActivator
- ✅ InstructionsDiscoverer + composition
- ✅ AgentRegistry + loader
- ✅ Official superagents plugin (research, plan, agent modes)

---

### 3. Plugin Security

**STATUS:** Same as original (TASK-PLUGIN-020..022)

Context-injection audits, sandboxing, resource limits. See original plan section 6.

- ✅ Context allowlist filtering
- ✅ Audit trail for injections
- ✅ Resource sandboxing (isolated-vm)

---

### 4. Secrets Broker

**STATUS:** Same as original (TASK-065)

Credential broker pattern with task-scoped TTL. See original plan section 7.

- ✅ CredentialBroker class
- ✅ Secret detection + redaction
- ✅ Audit logging

---

### 5. Token Budget Enforcement

**STATUS:** Same as original (TASK-063)

Hard caps with soft warnings. See original plan section 8.

- ✅ BudgetEnforcer with remaining calculation
- ✅ Pre-turn budget check
- ✅ Yellow/red warnings

---

### 6. Prompts Layer Types

**STATUS:** Same as original (TASK-064)

InstructionsComposer, SkillsComposer, budget allocation. See original plan section 9.

- ✅ Layer composition
- ✅ Budget model

---

### 7. CLI Agent Commands

**STATUS:** Same as original (TASK-SIA-022..025)

Agent picker, /agent command, /skills command. See original plan section 10.

- ✅ AgentPickerComponent
- ✅ /agent <name> command
- ✅ /skills list/show commands

---

## PART B: CRITICAL GAPS (REVISED ADDITIONS)

### Key Architectural Decision: Model-Tier and Replica-Aware Routing

**Tiers are defined on MODELS, not providers.** A provider may host models across all tiers. The gateway's `ModelEntry.tier` is the single source of truth. The orchestrator delegates ALL model selection to the gateway's `TierAwareModelSelector` and never encodes its own cost tables or tier assignments.

The gateway also owns replica-aware balancing:

- one logical model may have multiple replicas across providers/accounts
- tokenomics supplies hour/week/month headroom per replica
- gateway scores replicas using health, latency, cost, and quota headroom
- local replicas are preferred only for micro/small tasks
- `ModelTier = 'micro' | 'small' | 'mid' | 'frontier'` is defined in `@agentsy/gateway`
- `TaskTier = ModelTier` — the orchestrator re-exports this type
- `ProviderTier` no longer exists; provider-tier logic removed from `ProviderEntrySchema`
- `GatewayBackedModelRouter` bridges orchestrator → gateway
- Selection by cost, capability, local preference (`DefaultTierAwareModelSelector`)
- No backward-compatibility shims (gateway is unreleased)

This decision is implemented in commit `714e2cd2` and applies to all tier-routing tasks below.

### 8. Plan-Execute Boundary (NEW)

## TASK-ORCH-024: Add WorkflowPlan / WorkflowExecution Types

**Effort:** 1 hour

**Problem:** Plan and execution are conceptually separate but lack typed boundary. Industry consensus (Conductor, Claude Code workflows, Composio) emphasizes explicit plan→approval→execute flow.

**Solution:**

    // packages/orchestrator/src/types/plan.ts

    /**
     * Represents a high-level plan generated by LLM in "plan mode"
     * Does NOT execute — only describes intended actions + dependencies
     */
    export interface WorkflowPlan {
      id: string; // unique plan ID
      sessionId: string;
      goal: string; // original user request

      // Planned steps with dependencies
      steps: PlannedStep[];

      // Metadata for approval/cost estimation
      estimatedInputTokens: number;
      estimatedOutputTokens: number;
      estimatedCost: number; // USD

      // Metadata
      timestamp: Date;
      generatedBy: string; // agent ID
      approvalRequired: boolean;
      approvalDeadline?: Date;

      // Quality signals
      confidence: number; // 0-1; how confident the planner is
      assumptions: string[]; // things planner assumed
      risks: { risk: string; mitigation: string }[];
    }

    export interface PlannedStep {
      id: string;
      index: number;
      description: string;

      // Execution tier
      tier: 'micro' | 'small' | 'mid' | 'frontier';
      assignedAgent: string; // which agent/skill will execute

      // Resource estimation
      expectedInputTokens: number;
      expectedOutputTokens: number;
      estimatedCost: number;
      expectedDuration: number; // milliseconds

      // Dependencies
      dependencies: string[]; // step IDs that must complete first
      parallelizable: boolean; // can run in parallel with others

      // Success criteria (deterministic checks, not LLM evaluation)
      successGates: SuccessGate[];
    }

    export interface SuccessGate {
      type: 'test-pass' | 'lint-pass' | 'file-exists' | 'metric-threshold' | 'assertion';
      description: string;
      command?: string; // for test/lint gates
      expectedValue?: unknown; // for assertion gates
    }

    /**
     * Represents execution state once plan is approved
     * Tracks current progress, checkpoints, failures
     */
    export interface WorkflowExecution {
      id: string;
      planId: string; // MUST match a WorkflowPlan.id
      sessionId: string;

      // Execution status
      status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
      currentStepId?: string;

      // Completed steps + results
      completedSteps: ExecutedStep[];
      failedSteps: FailedStepRecord[];

      // Checkpoint for recovery
      checkpoint: CheckpointSnapshot;

      // Actual usage vs estimate
      actualInputTokens: number;
      actualOutputTokens: number;
      actualCost: number;

      // Timing
      startedAt: Date;
      completedAt?: Date;
      pauses: PausedInterval[]; // for approval gates
    }

    export interface ExecutedStep {
      stepId: string;
      actualAgent: string; // might differ from plan if escalated
      actualTier: string; // might escalate if budget insufficient

      startedAt: Date;
      completedAt: Date;

      // Tool calls made in this step
      toolCalls: {
        toolCallId: string;
        toolName: string;
        duration: number;
        inputTokens: number;
        outputTokens: number;
        status: 'success' | 'failure';
      }[];

      // Did it pass success gates?
      successGatesChecked: {
        gate: SuccessGate;
        passed: boolean;
        evidence?: string;
      }[];

      result: unknown;
    }

    export interface FailedStepRecord {
      stepId: string;
      error: { message: string; stack: string };
      recoveryAttempted: boolean;
      recoveryStrategy: 'retry' | 'fallback' | 'escalate' | 'skip';
      retriesAttempted: number;
    }

    export interface CheckpointSnapshot {
      stepIndex: number; // how many steps completed
      contextSnapshot: Record<string, unknown>; // serialized context
      toolResultCache: Map<string, unknown>; // for idempotency
      timestamp: Date;
    }

    export interface PausedInterval {
      stepId: string;
      pauseReason: 'approval-gate' | 'escalation' | 'manual';
      pausedAt: Date;
      resumedAt?: Date;
    }

**Integration:**

    // packages/orchestrator/src/session.ts

    export async function createAgentSession(
      agentDef: AgentDefinition,
      config: SessionOptions,
    ): Promise<AgentLoopHandle> {
      const session = new AgentSession(agentDef, config);

      if (config.plan) {
        // Plan mode: LLM generates WorkflowPlan, returns it
        session.mode = "plan";
        session.hooks.disable("pre-tool-call");
        const plan = await session.step(userMessage);
        return { plan }; // return WorkflowPlan
      }

      // Execution mode: must have planId to link to approved plan
      if (config.planId) {
        const approvedPlan = await db.getPlan(config.planId);
        session.execution = { planId: approvedPlan.id, status: 'running', ... };
        // Restore checkpoint if recovering from failure
        if (config.resumeCheckpointId) {
          session.checkpoint = await db.getCheckpoint(config.resumeCheckpointId);
        }
      }

      return session.handle();
    }

**Quality Gates:**

- ✅ WorkflowPlan serializes to JSON (no references)
- ✅ WorkflowExecution.planId matches an existing WorkflowPlan.id
- ✅ PlannedStep.dependencies form valid DAG (no cycles)
- ✅ SuccessGate types correctly validated per gate type

---

### 9. Task Board & Idempotency Abstraction (NEW)

## TASK-ORCH-025: Implement ITaskBoard Interface + In-Memory Impl

**Effort:** 2 hours

**Problem:** No persistent task tracking, no idempotency layer. Industry standard (Temporal, Kestra, Conductor) requires durable task board + deduplication.

**Solution:**

    // packages/orchestrator/src/task-board/types.ts

    export interface Task {
      id: string;
      workflowId: string;
      status: 'pending' | 'ready' | 'running' | 'completed' | 'failed';

      // Task definition
      title: string;
      description: string;
      agent: string;
      tier: string;

      // Dependencies
      dependencies: string[]; // task IDs

      // Execution tracking
      attempts: TaskAttempt[];
      currentAttempt: number;

      // Timing
      createdAt: Date;
      startedAt?: Date;
      completedAt?: Date;

      // Result
      result?: unknown;
      error?: { message: string; retryable: boolean };
    }

    export interface TaskAttempt {
      attemptNumber: number;
      startedAt: Date;
      completedAt?: Date;
      duration?: number;

      toolCalls: {
        toolCallId: string;
        toolName: string;
        inputTokens: number;
        outputTokens: number;
        status: 'success' | 'failure';
      }[];

      result?: unknown;
      error?: Error;
    }

    export interface ITaskBoard {
      // Queries
      getTask(id: string): Promise<Task>;
      listTasks(filter: Partial<Task>): Promise<Task[]>;

      // Get all dependencies (transitive closure)
      getDependencies(taskId: string, transitive: boolean): Promise<string[]>;

      // Get ready tasks (all dependencies satisfied)
      getReadyTasks(workflowId: string): Promise<Task[]>;

      // Mutations
      createTask(task: Omit<Task, 'id' | 'status' | 'attempts'>): Promise<string>;
      updateTask(id: string, updates: Partial<Task>): Promise<void>;
      startTask(id: string, agent: string): Promise<void>;
      completeTask(id: string, result: unknown): Promise<void>;
      failTask(id: string, error: Error, retryable: boolean): Promise<void>;

      // Idempotency: prevent duplicate execution
      recordToolExecution(toolCallId: string, result: unknown): Promise<void>;
      getToolExecutionResult(toolCallId: string): Promise<unknown | undefined>;

      // Checkpoint support
      saveCheckpoint(workflowId: string, snapshot: CheckpointSnapshot): Promise<string>;
      getCheckpoint(checkpointId: string): Promise<CheckpointSnapshot>;

      // Cleanup
      archiveWorkflow(workflowId: string): Promise<void>;
    }

**In-Memory Implementation:**

    // packages/orchestrator/src/task-board/in-memory.ts

    export class InMemoryTaskBoard implements ITaskBoard {
      private tasks: Map<string, Task> = new Map();
      private toolResultCache: Map<string, unknown> = new Map();
      private checkpoints: Map<string, CheckpointSnapshot> = new Map();

      async getTask(id: string): Promise<Task> {
        const task = this.tasks.get(id);
        if (!task) throw new NotFoundError(`Task ${id} not found`);
        return task;
      }

      async getReadyTasks(workflowId: string): Promise<Task[]> {
        const tasks = Array.from(this.tasks.values())
          .filter(t => t.workflowId === workflowId && t.status === 'pending');

        return tasks.filter(task => {
          for (const depId of task.dependencies) {
            const dep = this.tasks.get(depId);
            if (!dep || dep.status !== 'completed') return false;
          }
          return true;
        });
      }

      async recordToolExecution(toolCallId: string, result: unknown): Promise<void> {
        this.toolResultCache.set(toolCallId, result);
      }

      async getToolExecutionResult(toolCallId: string): Promise<unknown | undefined> {
        return this.toolResultCache.get(toolCallId);
      }

      // ... rest of implementation
    }

**Documentation:**

    ## Task Board Lifecycle

    1. **Plan Phase:**
       - LLM generates plan with steps
       - createTask() called for each step

    2. **Approval Phase:**
       - Human reviews plan
       - Approves or rejects

    3. **Execution Phase:**
       - getReadyTasks() returns tasks with satisfied dependencies
       - Agent executes task
       - recordToolExecution() logs result (idempotency)
       - completeTask() marks step done
       - Loop until all completed or one fails

    4. **Failure & Recovery:**
       - failTask() marks retryable
       - saveCheckpoint() before retry
       - Resume from checkpoint on retry

    5. **Cleanup:**
       - archiveWorkflow() moves to history
       - In-memory version can GC old workflows
       - Redis/Postgres backends persist for audit

**Quality Gates:**

- ✅ DAG validation: no cycles, all deps resolvable
- ✅ Idempotency: same toolCallId returns cached result
- ✅ Status transitions valid: pending→ready→running→completed
- ✅ Checkpoint roundtrip: snapshot→JSON→snapshot preserves data

---

### 10. Governance Policy Model (NEW)

## TASK-ORCH-026: Add GovernancePolicy Schema + Enforcer Hook

**Effort:** 2 hours

**Problem:** Hooks exist but no formal permissions model, escalation rules, or audit schema. Enterprise requirement (Deloitte, GitHub, Microsoft) mandates governance layer.

**Solution:**

    // packages/orchestrator/src/governance/policy.ts

    /**
     * Defines roles, permissions, approval gates, escalation rules, budgets
     * Enforced before tool execution and state mutations
     */
    export interface GovernancePolicy {
      id: string;
      name: string; // e.g., "default", "enterprise", "research"
      version: string;

      // Role definitions
      roles: Record<string, Role>;

      // Tool access control
      toolAccess: {
        toolId: string;
        allowedRoles: string[]; // which roles can call this tool
        requiresApproval: boolean;
      }[];

      // Approval gates (human sign-off required)
      approvalRules: {
        condition: string; // e.g., "toolName === 'git_push' && isForce"
        approvalRequired: boolean;
        maxApprovalTimeSeconds: number;
        approvalRoles: string[]; // who can approve (e.g., ['admin', 'codeowner'])
      }[];

      // Escalation (when to involve humans)
      escalationRules: {
        trigger: string; // e.g., "error.retryable === false"
        escalateTo: 'user' | 'admin' | 'on-call';
        maxWaitSeconds: number;
        actionOnTimeout: 'fail' | 'skip' | 'retry';
      }[];

      // Per-agent budgets
      budgetProfiles: Record<string, BudgetProfile>;

      // Audit configuration
      auditConfig: {
        logLevel: 'off' | 'error' | 'warn' | 'info' | 'debug';
        fieldsToLog: string[]; // what data to persist
        retentionDays: number;
        sinks: AuditSink[]; // export to logs, CloudWatch, etc.
      };
    }

    export interface Role {
      id: string;
      name: string;
      permissions: string[]; // e.g., ['tool:github_read', 'tool:aws_*']
      maxConcurrentTasks: number;
      maxCostUSDPerDay: number;
    }

    export interface BudgetProfile {
      tier: string;
      modelCap: string;
      tokensPerTask: number;
      costPerTask: number;
      maxConcurrency: number;
    }

    export interface AuditSink {
      type: 'file' | 'http' | 'cloudwatch' | 'datadog';
      config: Record<string, unknown>;
    }

    /**
     * Enforces policy on tool calls + state mutations
     */
    export class PolicyEnforcer {
      constructor(private policy: GovernancePolicy) {}

      async checkToolAccess(
        toolId: string,
        agentRole: string,
      ): Promise<{ allowed: boolean; requiresApproval: boolean }> {
        const rule = this.policy.toolAccess.find(r => r.toolId === toolId);
        if (!rule) return { allowed: true, requiresApproval: false };

        const allowed = rule.allowedRoles.includes(agentRole);
        return { allowed, requiresApproval: rule.requiresApproval };
      }

      checkApprovalRule(
        context: ToolCallContext,
      ): { requiresApproval: boolean; approvers: string[] } {
        for (const rule of this.policy.approvalRules) {
          if (this.evaluateCondition(rule.condition, context)) {
            return {
              requiresApproval: rule.approvalRequired,
              approvers: rule.approvalRoles,
            };
          }
        }
        return { requiresApproval: false, approvers: [] };
      }

      getEscalationRule(error: Error): EscalationRuleMatch | null {
        for (const rule of this.policy.escalationRules) {
          if (this.evaluateCondition(rule.trigger, { error })) {
            return rule;
          }
        }
        return null;
      }

      private evaluateCondition(condition: string, context: unknown): boolean {
        // Simple DSL: "toolName === 'git_push' && isForce === true"
        // Could use vm.runInNewContext() for safety
        try {
          const fn = new Function('ctx', `return ${condition}`);
          return fn(context);
        } catch (e) {
          // Log condition evaluation failure
          return false;
        }
      }

      async logAuditEvent(event: AuditEvent): Promise<void> {
        for (const sink of this.policy.auditConfig.sinks) {
          // Export to sink...
        }
      }
    }

    export interface AuditEvent {
      timestamp: Date;
      sessionId: string;
      agentId: string;
      eventType: 'tool_call' | 'approval' | 'escalation' | 'error';
      details: Record<string, unknown>;
      outcome: 'success' | 'blocked' | 'pending';
    }

**Hook Integration:**

    // packages/orchestrator/src/hooks/governance-gate.ts

    export function createGovernanceGate(policy: GovernancePolicy): HookDefinition<'pre-tool-call'> {
      const enforcer = new PolicyEnforcer(policy);

      return {
        name: 'governance:pre-tool-call',
        event: 'pre-tool-call',
        priority: 80, // runs after budget check but before execution
        handler: async (ctx) => {
          // 1. Check tool access
          const { allowed, requiresApproval } = await enforcer.checkToolAccess(
            ctx.toolCall.name,
            ctx.agentRole,
          );

          if (!allowed) {
            await enforcer.logAuditEvent({
              timestamp: new Date(),
              sessionId: ctx.sessionId,
              agentId: ctx.agentId,
              eventType: 'tool_call',
              details: { toolName: ctx.toolCall.name, reason: 'role_unauthorized' },
              outcome: 'blocked',
            });
            return { ...ctx, blocked: true, reason: 'Unauthorized role for this tool' };
          }

          // 2. Check approval rules
          const approval = enforcer.checkApprovalRule(ctx);
          if (approval.requiresApproval) {
            const approved = await ctx.requestApproval({
              toolCallId: ctx.toolCall.id,
              toolName: ctx.toolCall.name,
              timeoutMs: 30000,
              approvers: approval.approvers,
            });

            if (!approved) {
              await enforcer.logAuditEvent({
                timestamp: new Date(),
                sessionId: ctx.sessionId,
                agentId: ctx.agentId,
                eventType: 'approval',
                details: { toolName: ctx.toolCall.name, approved: false },
                outcome: 'blocked',
              });
              return { ...ctx, blocked: true, reason: 'Approval denied' };
            }
          }

          // 3. Log audit trail
          await enforcer.logAuditEvent({
            timestamp: new Date(),
            sessionId: ctx.sessionId,
            agentId: ctx.agentId,
            eventType: 'tool_call',
            details: {
              toolName: ctx.toolCall.name,
              approved: approval.requiresApproval,
            },
            outcome: 'success',
          });

          return ctx;
        },
      };
    }

**CROSS-PACKAGE INTEGRATION NOTE (from CROSS-PACKAGE-INTEGRATION-ANALYSIS.md):**

Clear separation: **Governance ≠ Guardrails**

- **Governance (Orchestrator):** RBAC, tool approvals, escalation policies, authorization audit trail
- **Guardrails (@agentsy/guardrails):** Content safety, prompt injection, PII, sycophancy, anthropomorphism

Hook execution order (via priority):

1. Governance gate (pre-tool-call, priority 80) — check RBAC + approval rules
2. Guardrails gate (pre-tool-call, priority 70) — check content policy
3. Tool execution (pre-tool-call handlers)
4. Recovery gate (post-tool-call, priority 20) — fallback + escalation

Both produce audit events → `@agentsy/tokenomics` ledger for unified audit trail.

**Quality Gates:**

- ✅ Condition DSL works for common patterns
- ✅ All audit events include timestamp + sessionId
- ✅ Escalation rules trigger on error.retryable === false
- ✅ Approval timeout enforced + defaults to deny

---

### 11. Model-Tier and Replica-Aware Routing (NEW)

## TASK-ORCH-027..029: Implement Decomposer + Cost Estimator + Tier Escalation

**Effort:** 3 hours total

**Problem:** Phase 4 mentions tiers but lacks formal decomposition algorithm, cost modeling, and escalation logic.

**Solution:**

    // packages/orchestrator/src/intelligence/decomposer.ts

    export interface DecomposerHeuristics {
      keywords: Record<string, 'micro' | 'small' | 'mid' | 'frontier'>;
      toolDiversity: { count: number; tier: string }[];
      branchingFactor: { outcomes: number; tier: string }[];
    }

    **CROSS-PACKAGE INTEGRATION NOTE (from CROSS-PACKAGE-INTEGRATION-ANALYSIS.md):**

    Gateway (`@agentsy/gateway`) already implements `TierAwareStrategy` with the exact tier model needed:
    - `ProviderTier` enum: micro / small / mid / frontier
    - `TierAwareStrategy.select()`: routes by tier + escalates on overload
    - `MetricsCollector`: per-provider cost metrics (p50/p95/p99, USD attribution)
    - `DEFAULT_ESCALATION_CHAIN`: micro → small → mid → frontier

    Orchestrator integration strategy:
    - Import `ProviderTier` from gateway (single source of truth)
    - TaskDecomposer assigns `assignedTier: ProviderTier` to subtasks
    - CostEstimator uses gateway's `ProviderTier` cost models
    - TierRouter delegates provider selection to gateway; focuses on agent/skill tier escalation

    This reduces orchestrator scope: gateway handles *provider* tier routing; orchestrator handles *task* tier routing.

    ```typescript
    const DEFAULT_HEURISTICS: DecomposerHeuristics = {
      keywords: {
        'research': 'micro',
        'retrieve': 'micro',
        'search': 'micro',
        'execute': 'mid',
        'implement': 'mid',
        'reason': 'frontier',
        'analyze': 'frontier',
        'design': 'frontier',
      },
      toolDiversity: [
        { count: 1, tier: 'micro' },
        { count: 2, tier: 'small' },
        { count: 3, tier: 'mid' },
        { count: 5, tier: 'frontier' },
      ],
      branchingFactor: [
        { outcomes: 2, tier: 'micro' },
        { outcomes: 4, tier: 'small' },
        { outcomes: 8, tier: 'mid' },
      ],
    };

    export class TaskDecomposer {
      constructor(
        private heuristics: DecomposerHeuristics = DEFAULT_HEURISTICS,
      ) {}

      decompose(goal: string, profile: AgentProfile): DecomposedTask[] {
        // 1. Parse goal into subtasks (simple: split by "then", "next", etc.)
        const sentences = goal.split(/\.\s+/);
        const tasks: DecomposedTask[] = sentences.map((desc, i) => ({
          id: `task-${i}`,
          description: desc,
          index: i,
          dependencies: i > 0 ? [`task-${i - 1}`] : [],
          assignedTier: this.scoreTier(desc),
          expectedInputTokens: 150, // placeholder
          expectedOutputTokens: 250,
          estimatedCost: 0, // computed by cost estimator
          toolsRequired: this.extractTools(desc),
          successGates: this.inferSuccessGates(desc),
        }));

        return tasks;
      }

      private scoreTier(
        description: string,
      ): 'micro' | 'small' | 'mid' | 'frontier' {
        const lc = description.toLowerCase();

        // 1. Keyword matching
        for (const [keyword, tier] of Object.entries(this.heuristics.keywords)) {
          if (lc.includes(keyword)) return tier;
        }

        // 2. Token estimate
        const estimatedTokens = description.split(/\s+/).length * 1.3;
        if (estimatedTokens < 50) return 'micro';
        if (estimatedTokens < 150) return 'small';
        if (estimatedTokens < 400) return 'mid';
        return 'frontier';
      }

      private extractTools(description: string): string[] {
        // Simple heuristic: look for tool names
        const toolPattern = /\b(git|ls|cat|grep|curl|python|test|lint|build)\b/gi;
        const matches = description.match(toolPattern) || [];
        return [...new Set(matches.map(m => m.toLowerCase()))];
      }

      private inferSuccessGates(description: string): SuccessGate[] {
        const gates: SuccessGate[] = [];
        const lc = description.toLowerCase();

        if (lc.includes('test')) {
          gates.push({
            type: 'test-pass',
            description: 'All tests pass',
          });
        }
        if (lc.includes('lint') || lc.includes('format')) {
          gates.push({
            type: 'lint-pass',
            description: 'Linting passes',
          });
        }
        if (lc.includes('build') || lc.includes('compile')) {
          gates.push({
            type: 'test-pass',
            description: 'Build succeeds',
          });
        }

        return gates;
      }
    }

    // packages/orchestrator/src/intelligence/cost-estimator.ts

    export interface TierCostModel {
      tier: string;
      modelName: string;
      inputCostPer1kTokens: number;
      outputCostPer1kTokens: number;
      averageOutputRatio: number; // typical output/input ratio
    }

    const TIER_COST_MODELS: TierCostModel[] = [
      {
        tier: 'micro',
        modelName: 'claude-haiku',
        inputCostPer1kTokens: 0.00080,
        outputCostPer1kTokens: 0.0040,
        averageOutputRatio: 2.0,
      },
      {
        tier: 'small',
        modelName: 'claude-opus-4-mini',
        inputCostPer1kTokens: 0.003,
        outputCostPer1kTokens: 0.015,
        averageOutputRatio: 2.5,
      },
      {
        tier: 'mid',
        modelName: 'claude-opus-4.5',
        inputCostPer1kTokens: 0.015,
        outputCostPer1kTokens: 0.060,
        averageOutputRatio: 3.0,
      },
      {
        tier: 'frontier',
        modelName: 'claude-opus-4.5-extended',
        inputCostPer1kTokens: 0.030,
        outputCostPer1kTokens: 0.120,
        averageOutputRatio: 4.0,
      },
    ];

    export class CostEstimator {
      private models: Map<string, TierCostModel>;

      constructor(models: TierCostModel[] = TIER_COST_MODELS) {
        this.models = new Map(models.map(m => [m.tier, m]));
      }

      estimateCost(task: DecomposedTask): number {
        const model = this.models.get(task.assignedTier);
        if (!model) throw new Error(`Unknown tier: ${task.assignedTier}`);

        const inputCost = (task.expectedInputTokens / 1000) * model.inputCostPer1kTokens;
        const outputCost = (task.expectedOutputTokens / 1000) * model.outputCostPer1kTokens;
        return inputCost + outputCost;
      }
    }

    // packages/orchestrator/src/intelligence/tier-router.ts

    export class TierRouter {
      constructor(
        private estimator: CostEstimator,
        private budgetRemaining: number,
      ) {}

      /**
       * Given remaining budget and current task, suggest tier escalation if needed
       */
      suggestEscalation(
        task: DecomposedTask,
      ): { newTier: string; reason: string } | null {
        const cost = this.estimator.estimateCost(task);

        if (cost > this.budgetRemaining) {
          // Escalate to cheaper tier
          const tierOrder = ['frontier', 'mid', 'small', 'micro'];
          const currentIdx = tierOrder.indexOf(task.assignedTier);
          const cheaperTier = tierOrder[currentIdx + 1];

          if (cheaperTier) {
            const taskWithCheaperTier = { ...task, assignedTier: cheaperTier };
            const newCost = this.estimator.estimateCost(taskWithCheaperTier);

            if (newCost <= this.budgetRemaining) {
              return {
                newTier: cheaperTier,
                reason: `Cost ${cost.toFixed(4)} exceeds budget ${this.budgetRemaining.toFixed(4)}; downgrading to ${cheaperTier}`,
              };
            }
          }

          // No cheaper tier available
          return null;
        }

        return null; // No escalation needed
      }
    }

**Quality Gates:**

- ✅ Decomposition produces valid DAG (no cycles)
- ✅ Cost estimates consistent (higher tier → higher cost)
- ✅ Tier order respected: frontier > mid > small > micro
- ✅ Escalation suggestions reduce cost

---

### 12. Context Isolation & Resource Locking (NEW)

## TASK-ORCH-030..031: Add ContextManager + Lock Protocol

**Effort:** 2 hours

**Problem:** No explicit context isolation between agents; no locking for shared state. Industry pattern (Composio, Temporal, microservices) requires context flipping + lock protocol.

**Solution:**

    // packages/context/src/context-manager.ts

    export interface ContextFrame {
      frameId: string;
      sessionId: string;
      agentId: string;
      parentAgentId?: string; // for subagent delegation chains

      // Which fields this agent can see
      visibleFields: Set<string>;

      // Which resources this agent has locked
      lockedResources: Map<string, LockToken>;

      // Timestamps
      createdAt: Date;
      expiresAt: Date; // auto-pop if not explicitly popped
    }

    export interface LockToken {
      resource: string;
      heldBy: string; // agent ID
      acquiredAt: Date;
      expiresAt: Date;
      ttlMs: number;
    }

    export class ContextManager {
      private frames: Map<string, ContextFrame> = new Map();
      private globalContext: Record<string, unknown>;
      private locks: Map<string, LockToken> = new Map();

      /**
       * Create isolated context for subagent
       * Only visible fields are included; parent context not leaked
       */
      pushContext(
        sessionId: string,
        parentAgentId: string,
        childAgentId: string,
        visibleFields: string[],
      ): ContextFrame {
        const frameId = `frame-${Date.now()}`;
        const frame: ContextFrame = {
          frameId,
          sessionId,
          agentId: childAgentId,
          parentAgentId,
          visibleFields: new Set(visibleFields),
          lockedResources: new Map(),
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min TTL
        };

        this.frames.set(frameId, frame);
        return frame;
      }

      /**
       * Restore parent context, release all locks
       */
      async popContext(frameId: string): Promise<void> {
        const frame = this.frames.get(frameId);
        if (!frame) throw new Error(`Frame ${frameId} not found`);

        // Release all locks held by this agent
        for (const [resource, lock] of frame.lockedResources) {
          await this.releaseLock(resource, frame.agentId);
        }

        this.frames.delete(frameId);
      }

      /**
       * Get only visible fields for agent in this context
       */
      getVisibleContext(frameId: string): Record<string, unknown> {
        const frame = this.frames.get(frameId);
        if (!frame) return {};

        const visible: Record<string, unknown> = {};
        for (const field of frame.visibleFields) {
          if (field in this.globalContext) {
            visible[field] = this.globalContext[field];
          }
        }
        return visible;
      }

      /**
       * Acquire exclusive lock on resource
       * Prevents concurrent mutations
       */
      async acquireLock(
        resource: string,
        agentId: string,
        frameId: string,
        ttlMs: number = 5000,
      ): Promise<LockToken> {
        const existing = this.locks.get(resource);
        if (existing && existing.expiresAt > new Date()) {
          throw new Error(`Resource ${resource} locked by ${existing.heldBy}`);
        }

        const token: LockToken = {
          resource,
          heldBy: agentId,
          acquiredAt: new Date(),
          expiresAt: new Date(Date.now() + ttlMs),
          ttlMs,
        };

        this.locks.set(resource, token);
        const frame = this.frames.get(frameId);
        if (frame) {
          frame.lockedResources.set(resource, token);
        }

        return token;
      }

      /**
       * Release lock
       */
      async releaseLock(resource: string, agentId: string): Promise<void> {
        const lock = this.locks.get(resource);
        if (!lock || lock.heldBy !== agentId) {
          throw new Error(`No lock held by ${agentId} on ${resource}`);
        }

        this.locks.delete(resource);
      }

      /**
       * Clean up expired frames + locks
       */
      cleanup(): void {
        const now = new Date();
        for (const [frameId, frame] of this.frames) {
          if (frame.expiresAt < now) {
            this.frames.delete(frameId);
          }
        }
        for (const [resource, lock] of this.locks) {
          if (lock.expiresAt < now) {
            this.locks.delete(resource);
          }
        }
      }
    }

**Integration:**

    // When delegating to subagent:
    const parentAgent = 'orchestrator';
    const childAgent = 'researcher';
    const visibleFields = ['goal', 'memory', 'session_id']; // NOT internals

    const frame = contextManager.pushContext(
      sessionId,
      parentAgent,
      childAgent,
      visibleFields,
    );

    const childContext = contextManager.getVisibleContext(frame.frameId);
    // { goal: '...', memory: '...', session_id: '...' }
    // Does NOT include: systemPrompt, hooks, authTokens, etc.

    // When child needs to modify shared state:
    const lock = await contextManager.acquireLock('config.json', childAgent, frame.frameId);
    // modify...
    await contextManager.releaseLock('config.json', childAgent);

    // When subagent completes:
    await contextManager.popContext(frame.frameId);
    // All locks released, frame cleared

**Quality Gates:**

- ✅ Context flipping only exposes declared fields
- ✅ Lock acquisition times out + fails gracefully
- ✅ Subagent can't access parent context
- ✅ Frame cleanup on expiry prevents memory leaks

---

### 13. Error Recovery Framework (NEW)

## TASK-ORCH-032: Add RecoveryPolicy + Executor Hook

**Effort:** 1.5 hours

**Problem:** Only mention of retry is in TaskNodeSchema; no fallback routing, escalation, or skip strategy. Industry standard (Temporal, Saga pattern, microservices) requires structured recovery.

**Solution:**

    // packages/orchestrator/src/recovery/policy.ts

    export interface RecoveryPolicy {
      // Retry strategy for transient failures
      retryConfig: {
        maxAttempts: number;
        backoffStrategy: 'linear' | 'exponential' | 'fixed';
        baseDelayMs: number;
        maxDelayMs: number;
        jitterFraction: number; // 0-1; randomize delay by this %
      };

      // Fallback: use alternative agent/tier if primary fails
      fallbacks: {
        condition: string; // e.g., "error.retryable && attempts >= 2"
        agent: string; // agent/tier to try next
        maxAttempts: number;
      }[];

      // Escalation: what to do if all recovery strategies exhausted
      escalationAction: 'fail' | 'escalate' | 'skip' | 'default';
      escalationTarget?: string; // admin email, on-call channel, etc.

      // Checkpoint: save before executing, restore on failure
      checkpointRequired: boolean;
      checkpointFrequencyMs: number; // checkpoint every N ms
    }

    export class RecoveryExecutor {
      async execute(
        task: Task,
        policy: RecoveryPolicy,
        executor: (agent: string) => Promise<unknown>,
      ): Promise<unknown> {
        let lastError: Error | null = null;
        let attempt = 0;

        // 1. Retry loop
        while (attempt < policy.retryConfig.maxAttempts) {
          try {
            return await executor(task.agent);
          } catch (e) {
            lastError = e as Error;
            attempt++;

            if (attempt >= policy.retryConfig.maxAttempts) break;

            // Check if retryable
            const isRetryable = (e as any).retryable !== false;
            if (!isRetryable) break;

            // Calculate backoff
            const delay = this.calculateBackoff(attempt, policy.retryConfig);
            await this.sleep(delay);
          }
        }

        // 2. Fallback loop
        for (const fallback of policy.fallbacks) {
          if (this.evaluateCondition(fallback.condition, { error: lastError, attempts: attempt })) {
            for (let fallbackAttempt = 0; fallbackAttempt < fallback.maxAttempts; fallbackAttempt++) {
              try {
                return await executor(fallback.agent);
              } catch (e) {
                lastError = e as Error;
                // Continue to next fallback
              }
            }
          }
        }

        // 3. Escalation
        switch (policy.escalationAction) {
          case 'fail':
            throw lastError || new Error('Task failed');
          case 'escalate':
            // Request human intervention (will be handled by approval hook)
            return { escalated: true, taskId: task.id, error: lastError?.message };
          case 'skip':
            // Log but continue
            console.warn(`Skipping task ${task.id}: ${lastError?.message}`);
            return null;
          case 'default':
            // Use default/empty result
            return {};
        }
      }

      private calculateBackoff(
        attempt: number,
        config: RetryConfig,
      ): number {
        let delay: number;

        switch (config.backoffStrategy) {
          case 'linear':
            delay = config.baseDelayMs * attempt;
            break;
          case 'exponential':
            delay = config.baseDelayMs * Math.pow(2, attempt - 1);
            break;
          case 'fixed':
            delay = config.baseDelayMs;
            break;
        }

        // Cap at maxDelayMs
        delay = Math.min(delay, config.maxDelayMs);

        // Add jitter
        const jitter = delay * config.jitterFraction * (Math.random() - 0.5);
        return delay + jitter;
      }

      private evaluateCondition(
        condition: string,
        context: unknown,
      ): boolean {
        try {
          const fn = new Function('ctx', `return ${condition}`);
          return fn(context);
        } catch {
          return false;
        }
      }

      private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
      }
    }

**Hook Integration:**

    // packages/orchestrator/src/hooks/recovery-gate.ts

    export function createRecoveryHook(
      policy: RecoveryPolicy,
    ): HookDefinition<'post-tool-call'> {
      const executor = new RecoveryExecutor();

      return {
        name: 'recovery:post-tool-call',
        event: 'post-tool-call',
        priority: 20,
        handler: async (ctx) => {
          if (ctx.toolCallStatus === 'success') {
            return ctx; // No recovery needed
          }

          const error = ctx.toolCallError as Error;
          const result = await executor.execute(
            { agent: ctx.agentId } as Task,
            policy,
            async (agent) => {
              // Re-execute with fallback agent if provided
              return await ctx.retryToolCall(agent);
            },
          );

          return { ...ctx, toolCallResult: result };
        },
      };
    }

**Quality Gates:**

- ✅ Backoff strategies all work (exponential, linear, fixed)
- ✅ Jitter prevents thundering herd
- ✅ Escalation action deterministic
- ✅ Fallback conditions correctly evaluated

---

### 14. Hook Conflict Resolution (NEW)

## TASK-ORCH-033: Add Hook Dependency Graph + Conflict Detection

**Effort:** 1 hour

**Problem:** Hooks run in priority order; no conflict detection if two hooks both modify `ctx.systemPrompt`. Need DAG validation.

**Solution:**

    // packages/orchestrator/src/hooks/registry.ts (extend)

    export interface HookDefinition<E extends HookEvent> {
      name: string;
      event: E;
      priority: number; // 0-100; higher runs first
      enabled: boolean;
      handler: (ctx: HookContext<E>) => Promise<HookContext<E>>;

      // NEW: Dependency graph
      dependencies?: string[]; // must run after these hooks

      // NEW: Conflict specification
      conflicts?: {
        hookName: string;
        contextFields: string[]; // which fields conflict
        strategy: 'merge' | 'first-wins' | 'error'; // resolution strategy
      }[];
    }

    // packages/orchestrator/src/hooks/compile.ts (extend)

    export interface HookExecutionPlan {
      order: string[]; // hook names in execution order
      conflicts: ConflictWarning[];
    }

    export interface ConflictWarning {
      hook1: string;
      hook2: string;
      field: string;
      strategy: string;
      reason: string;
    }

    export function compileHooks(
      registry: HookRegistry,
      baseOptions: AgentLoopOptions,
    ): HookExecutionPlan {
      const hooks = registry.listHooks();

      // 1. Build dependency graph
      const graph = new Map<string, Set<string>>();
      for (const hook of hooks) {
        const deps = hook.dependencies || [];
        graph.set(hook.name, new Set(deps));
      }

      // 2. Topological sort (DFS)
      const sorted = topologicalSort(graph);

      // 3. Check for cycles
      const visited = new Set<string>();
      for (const hookName of sorted) {
        if (visited.has(hookName)) {
          throw new Error(`Cycle detected in hook dependencies: ${hookName}`);
        }
        visited.add(hookName);
      }

      // 4. Detect conflicts
      const conflicts: ConflictWarning[] = [];
      for (const hook of hooks) {
        for (const conflict of hook.conflicts || []) {
          const other = registry.getHook(conflict.hookName);
          if (!other) continue;

          conflicts.push({
            hook1: hook.name,
            hook2: other.name,
            field: conflict.contextFields.join(', '),
            strategy: conflict.strategy,
            reason: `Both hooks modify ${conflict.contextFields.join(', ')}`,
          });
        }
      }

      // 5. Sort by priority + dependencies
      sorted.sort((a, b) => {
        const hookA = registry.getHook(a);
        const hookB = registry.getHook(b);

        // Dependencies first, then by priority
        if ((hookA?.dependencies || []).includes(b)) return 1;
        if ((hookB?.dependencies || []).includes(a)) return -1;

        return (hookB?.priority || 0) - (hookA?.priority || 0);
      });

      return { order: sorted, conflicts };
    }

    function topologicalSort(graph: Map<string, Set<string>>): string[] {
      const result: string[] = [];
      const visited = new Set<string>();
      const rec = new Set<string>();

      const visit = (node: string) => {
        if (visited.has(node)) return;
        if (rec.has(node)) throw new Error(`Cycle detected at ${node}`);

        rec.add(node);
        for (const dep of graph.get(node) || []) {
          visit(dep);
        }
        rec.delete(node);

        visited.add(node);
        result.push(node);
      };

      for (const node of graph.keys()) {
        visit(node);
      }

      return result;
    }

**Usage:**

    const memory = createMemoryPreTurnHook();
    const instructions = createInstructionsHook(discoverer);
    const skills = createSkillsHook(discoverer, activator);

    // Link dependencies
    instructions.dependencies = []; // runs first
    skills.dependencies = ['instructions:inject']; // after instructions
    memory.conflicts = [
      {
        hookName: 'instructions:inject',
        contextFields: ['systemPrompt'],
        strategy: 'merge', // combine memory + instructions in systemPrompt
      },
    ];

    registry.register(memory);
    registry.register(instructions);
    registry.register(skills);

    const plan = compileHooks(registry, options);
    console.log(plan.order); // ['instructions:inject', 'skills:activate', 'memory:pre-turn']
    console.log(plan.conflicts); // warnings about merged systemPrompt

**Quality Gates:**

- ✅ DAG validation detects cycles
- ✅ Topological sort respects dependencies
- ✅ Conflicts identified + strategy applied
- ✅ Hook ordering deterministic (priority + dependencies)

---

### 15. Multi-Agent Span Schema (NEW)

## TASK-ORCH-034: Add AgentSpan Type + Multi-Agent Tracer

**Effort:** 1.5 hours

**Problem:** Observability hook emits simple span; no parent-child relationships, no cost attribution. Need hierarchical tracing for subagent delegation.

**Solution:**

**CROSS-PACKAGE INTEGRATION NOTE (from CROSS-PACKAGE-INTEGRATION-ANALYSIS.md):**

`@agentsy/tokenomics` (Phase 19–20) already plans `SessionLedgerEntry` with:

- `spend: SpendRecord[]` (input/output tokens, cost, cache efficiency)
- `frustration: FrustrationScore` (passive signal detection)
- `quality: QualityRecord[]` (gate results, artifact counts)

Orchestrator integration:

1. Extend `SessionLedgerEntry` with correlation fields: `traceId: string`, `parentLedgerId?: string`
2. Create lightweight `AgentSpan` type → maps to `LedgerEntry` record (no separate schema)
3. Runtime hooks emit span lifecycle (start, tool-call, end) → tokenomics captures via post-session hook
4. Gateway `MetricsCollector` already tracks per-provider cost; ledger aggregates across agents

This means:

- Single audit substrate (tokenomics ledger, not separate spans)
- Cost attribution per agent step via ledger entries
- Trace correlation via `traceId` + parent linking

  // packages/observability/src/spans/agent-span.ts

  export interface AgentSpan {
  // Identifiers
  traceId: string; // root request ID (same across all spans in trace)
  spanId: string; // unique to this span
  parentSpanId?: string; // parent agent span (for subagent calls)

      // Agent context
      agentId: string;
      agentRole?: string;
      agentTier?: 'micro' | 'small' | 'mid' | 'frontier';

      // Operation
      operationName: 'plan' | 'execute' | 'delegate' | 'synthesize' | 'recover';

      // Timing
      startTime: Date;
      endTime?: Date;
      duration?: number; // milliseconds

      // Tokens & cost
      inputTokens: number;
      outputTokens: number;
      estimatedCost: number; // USD

      // Tools used in this span
      toolCalls: {
        toolCallId: string;
        toolName: string;
        startTime: Date;
        endTime: Date;
        duration: number;
        inputTokens: number;
        outputTokens: number;
        status: 'success' | 'failure' | 'timeout';
        costAttribution: number;
        error?: string;
      }[];

      // Subagent delegation
      delegatedTo?: string; // agent ID if this agent delegated
      subspans: AgentSpan[]; // child spans (subagents)

      // Result & Error
      status: 'running' | 'succeeded' | 'failed' | 'retrying';
      result?: unknown;
      error?: {
        message: string;
        stack?: string;
        retryable: boolean;
      };

      // Metadata
      metadata: Record<string, unknown>;
  }

  // packages/observability/src/tracer/multi-agent.ts

  export class MultiAgentTracer {
  private spans: Map<string, AgentSpan> = new Map();
  private spanStack: string[] = []; // for nesting

      createRootSpan(
        traceId: string,
        agentId: string,
        operationName: string,
      ): AgentSpan {
        const span: AgentSpan = {
          traceId,
          spanId: `span-${Date.now()}-${Math.random()}`,
          agentId,
          operationName: operationName as any,
          startTime: new Date(),
          inputTokens: 0,
          outputTokens: 0,
          estimatedCost: 0,
          toolCalls: [],
          subspans: [],
          status: 'running',
          metadata: {},
        };

        this.spans.set(span.spanId, span);
        this.spanStack.push(span.spanId);
        return span;
      }

      createChildSpan(
        traceId: string,
        parentSpanId: string,
        agentId: string,
        operationName: string,
      ): AgentSpan {
        const parent = this.spans.get(parentSpanId);
        if (!parent) throw new Error(`Parent span ${parentSpanId} not found`);

        const span: AgentSpan = {
          traceId,
          spanId: `span-${Date.now()}-${Math.random()}`,
          parentSpanId,
          agentId,
          operationName: operationName as any,
          startTime: new Date(),
          inputTokens: 0,
          outputTokens: 0,
          estimatedCost: 0,
          toolCalls: [],
          subspans: [],
          status: 'running',
          metadata: {},
        };

        parent.subspans.push(span);
        this.spans.set(span.spanId, span);
        this.spanStack.push(span.spanId);
        return span;
      }

      recordToolCall(
        spanId: string,
        toolName: string,
        duration: number,
        inputTokens: number,
        outputTokens: number,
        status: 'success' | 'failure' | 'timeout',
        costAttribution: number,
      ): void {
        const span = this.spans.get(spanId);
        if (!span) return;

        span.toolCalls.push({
          toolCallId: `tool-${Date.now()}`,
          toolName,
          startTime: new Date(Date.now() - duration),
          endTime: new Date(),
          duration,
          inputTokens,
          outputTokens,
          status,
          costAttribution,
        });

        span.inputTokens += inputTokens;
        span.outputTokens += outputTokens;
        span.estimatedCost += costAttribution;
      }

      finishSpan(spanId: string, status: 'succeeded' | 'failed', result?: unknown, error?: Error): void {
        const span = this.spans.get(spanId);
        if (!span) return;

        span.status = status;
        span.endTime = new Date();
        span.duration = span.endTime.getTime() - span.startTime.getTime();
        span.result = result;

        if (error) {
          span.error = {
            message: error.message,
            stack: error.stack,
            retryable: (error as any).retryable !== false,
          };
        }

        this.spanStack.pop();
      }

      getTrace(traceId: string): AgentSpan[] {
        return Array.from(this.spans.values()).filter(s => s.traceId === traceId);
      }

      getCurrentSpan(): AgentSpan | undefined {
        const spanId = this.spanStack[this.spanStack.length - 1];
        return spanId ? this.spans.get(spanId) : undefined;
      }
  }

**Hook Integration:**

    // packages/orchestrator/src/hooks/observability.ts (updated)

    export function createObservabilityHook(tracer: MultiAgentTracer): HookDefinition<'beforeInit'> {
      return {
        name: 'observability:trace',
        event: 'beforeInit',
        priority: 5,
        handler: async (ctx) => {
          const span = tracer.createRootSpan(
            ctx.traceId || `trace-${Date.now()}`,
            ctx.agentId,
            'execute',
          );

          ctx.span = span;
          ctx.traceId = span.traceId;
          return ctx;
        },
      };
    }

    export function createToolCallTracingHook(
      tracer: MultiAgentTracer,
    ): HookDefinition<'post-tool-call'> {
      return {
        name: 'observability:tool-call',
        event: 'post-tool-call',
        priority: 5,
        handler: async (ctx) => {
          const span = tracer.getCurrentSpan();
          if (!span) return ctx;

          tracer.recordToolCall(
            span.spanId,
            ctx.toolCall.name,
            ctx.toolCallDuration,
            ctx.inputTokens,
            ctx.outputTokens,
            ctx.toolCallStatus === 'success' ? 'success' : 'failure',
            ctx.estimatedCost,
          );

          return ctx;
        },
      };
    }

**Quality Gates:**

- ✅ Span hierarchy correctly nests (parent-child relationships)
- ✅ traceId consistent across entire request
- ✅ Cost attribution per tool call
- ✅ Critical path computable (max duration through subspans)

---

## Summary of Revisions

### Gap Closures

| Gap | Priority | Solution | Effort | Status |
|-----|----------|----------|--------|--------|
| Plan-Execute boundary | High | WorkflowPlan/Execution types | 1h | ✅ |
| Task board persistence | High | ITaskBoard interface | 2h | ✅ |
| Governance model | High | GovernancePolicy + enforcer | 2h | ✅ |
| Tier decomposition | Medium | Decomposer + cost estimator | 3h | ✅ |
| Context isolation | High | ContextManager + locking | 2h | ✅ |
| Error recovery | Medium | RecoveryPolicy + executor | 1.5h | ✅ |
| Hook conflicts | Low | DAG validation + topological sort | 1h | ✅ |
| Observability | Medium | AgentSpan + multi-agent tracer | 1.5h | ✅ |

**Total:** 14 hours (fits in Phase 4 budget)

### Phasing Recommendation

**Phase 4.1 — Foundation (8 hours):**

- TASK-ORCH-024: Plan-Execute boundary
- TASK-ORCH-025: Task board
- TASK-ORCH-030..031: Context isolation + locking
- TASK-ORCH-033: Hook conflict resolution

**Phase 4.2 — Governance (5 hours):**

- TASK-ORCH-026: Governance policy
- TASK-ORCH-032: Recovery framework
- TASK-ORCH-034: AgentSpan tracing

**Phase 4.3 — Intelligence (3 hours):**

- TASK-ORCH-027..029: Tier decomposition + cost modeling

---

## Next Phase

**Phase 5 — Tools & Approvals:**

- Implement tool execution layer
- Integrate approval workflows
- Connect to governance policy
- Add tool versioning + backwards compat
