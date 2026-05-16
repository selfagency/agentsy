---
goal: @agentsy/orchestrator production implementation plan
version: 1.0
date_created: 2026-05-15
last_updated: 2026-05-15
owner: orchestrator-maintainers
status: In progress
tags: [feature, architecture, orchestrator, planning, autonomy]
---

# Introduction

![Status: In progress](https://img.shields.io/badge/status-In%20progress-yellow)

This plan defines the production implementation order for `@agentsy/orchestrator` as the multi-step planning and execution-mode authority.

## 1. Requirements & Constraints

- **REQ-ORCH-001**: Orchestrator supports explicit execution modes (single, orchestrated, constrained autonomous).
- **REQ-ORCH-002**: Plan/act loops are token-budget-aware and fail safely when limits are exceeded.
- **REQ-ORCH-003**: Task-board semantics support durable backend options and deterministic recovery.
- **REQ-ORCH-004**: Slash-command interception and mode controls are policy-aware and explainable.
- **REQ-ORCH-005**: Orchestrator must consume plugin-defined agent modes (including official superagents `research`, `plan`, and `agent`) through stable mode contracts rather than hardcoded internal personas.
- **SEC-ORCH-001**: Autonomous mode requires explicit policy profile and hard ceilings.
- **SEC-ORCH-002**: Decision traces preserve explainability without exposing secrets.
- **CON-ORCH-001**: Concrete tool execution remains in runtime/tools.
- **CON-ORCH-002**: Provider protocol adaptation remains in providers/core.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-ORCH-001: Strategy contract stabilization.

| Task          | Description                                                              | Completed | Date |
| ------------- | ------------------------------------------------------------------------ | --------- | ---- |
| TASK-ORCH-001 | Finalize planner/strategy interfaces and execution-mode contract schema. |           |      |
| TASK-ORCH-002 | Stabilize task-board and persistence abstraction boundaries.             |           |      |
| TASK-ORCH-003 | Document orchestration ownership vs runtime/tools boundaries.            |           |      |

### Implementation Phase 2

- GOAL-ORCH-002: Core orchestration implementation.

| Task          | Description                                                                                                                                            | Completed | Date |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ---- |
| TASK-ORCH-004 | Implement deterministic plan/act loops with guardrail/budget checkpoints.                                                                              |           |      |
| TASK-ORCH-005 | Implement mode profiles and fallback/downgrade behavior.                                                                                               |           |      |
| TASK-ORCH-006 | Finalize task persistence and scheduling/backoff semantics.                                                                                            |           |      |
| TASK-ORCH-013 | Add mode-contract support for plugin-supplied `research`, `plan`, and `agent` supermodes with deterministic handoff points between plan and execution. |           |      |

### Implementation Phase 3

- GOAL-ORCH-003: Integration and operator controls.

| Task          | Description                                                                  | Completed | Date |
| ------------- | ---------------------------------------------------------------------------- | --------- | ---- |
| TASK-ORCH-007 | Integrate CLI/runtime slash controls and mode telemetry events.              |           |      |
| TASK-ORCH-008 | Add integration tests for budget rejection, downscoping, and fallback paths. |           |      |
| TASK-ORCH-009 | Validate observability and session interaction coverage.                     |           |      |

### Implementation Phase 4

- GOAL-ORCH-004: Hardening and release gates.

| Task          | Description                                                                     | Completed | Date |
| ------------- | ------------------------------------------------------------------------------- | --------- | ---- |
| TASK-ORCH-010 | Add regressions for autonomy safety, persistence recovery, and race conditions. |           |      |
| TASK-ORCH-011 | Align docs and custom-agent guidance with shipped behavior.                     |           |      |
| TASK-ORCH-012 | Pass package and monorepo release gates.                                        |           |      |

## 3. Acceptance Criteria

- **ACC-ORCH-001**: Execution-mode semantics and planner outcomes are deterministic and test-validated.
- **ACC-ORCH-002**: Runtime/CLI integration and budget safety checks pass.
- **ACC-ORCH-003**: Release gates pass.

## 4. Sources Synthesized

- `plan/MASTER-IMPLEMENTATION-PLAN.md`
- `plan/IMPLEMENTATION-PRIORITY.md`
- `plan/feature-cli-dogfood-production-order-1.md`
- `plan/feature-advanced-capabilities-phase4-1.md`
- `packages/orchestrator/README.md`
- `packages/orchestrator/IMPLEMENTATION-PLAN.md`

## 5. Existing Package Deep-Dive (Preserved)

---

## @agentsy/orchestrator — Implementation Plan

> Update: the older Caveman/Superpowers/Garry's-mode concept below is superseded by a first-party official superagents plugin distributed through `@agentsy/plugins` and bundled by `@agentsy/cli`. Preserve the methodology ideas; do not keep those third-party brands as canonical product modes.

## Custom Agent Modes — `@agentsy/orchestrator/agents`

> Source: `plan/agentsy-agents-v1.md` — Migrated from standalone plan. Package lives at `packages/agents/` (to be created) with package name `@agentsy/orchestrator/agents`. Three bundled agent modes: caveman, superpowers, garry's mode. No separate `@agentsy/caveman` or `@agentsy/superpowers` packages.

### Requirements

- **REQ-071**: Export three agent mode factories: `createCavemanManager`, `createSuperpowersActivator`, `createGarrysAgent`. Each implements `AgentModeFactory<TOptions, TActivator>`.
- **REQ-072**: All SKILL.md files bundled directly inside `packages/agents/src/skills/`. No external caveman/superpowers packages.
- **REQ-073**: Garry's mode bundles nine sprint SKILL.md files: `office-hours`, `plan-ceo-review`, `plan-eng-review`, `review`, `ship`, `qa`, `cso`, `investigate`, `autoplan`. Each includes `source_url`, `version`, `license: "MIT"` frontmatter.
- **REQ-074**: `GarrysActivator.detectPhase(context)` infers sprint phase from context signals: PR diff present → `review`, test failures → `test`, open-ended product question → `think`.
- **REQ-075**: `GarrysActivator.selectSkills(phase)` returns ≤3 `GarrysSkillManifest[]` for the given phase.
- **REQ-076**: Garry's checkpoint emits `WIP:` prefixed commit after every tool-call turn (when `checkpointMode: true`). Commit body includes `[gstack-context]` block: decisions, remaining work, failed approaches.
- **REQ-077**: Safety guardrails register a pre-execution hook that fires `SafetyGuardrailTriggered` before any tool call matching: `rm -rf`, `DROP TABLE`, `force-push`, `git reset --hard`, `git push --force`.
- **REQ-078**: Design taste memory persists per-project decisions to `~/.agentsy/taste/<projectId>.json` via `@agentsy/memory` with `retentionTag: 'design-preference'`. Scores decay 5% per week.
- **REQ-079**: `docs/developers/custom-agents.md` documents pattern with three worked examples showing: SKILL.md bundling, context-signal activation, factory pattern, agent loop integration.
- **REQ-080**: Zero runtime deps beyond `@agentsy/core`. `@agentsy/memory` is peer dep for garry's `tasteMemory` option only.
- **REQ-103**: Garry's `investigate` phase implements LATS-style multi-path exploration: up to 3 alternative strategies, lightweight scoring prompt, commit to highest-scoring path. Max tree depth: 2.
- **REQ-104**: Garry's `review` phase implements Evaluator-Optimizer loop: generator sub-turn → evaluator critique → up to 2 refinement passes.
- **REQ-109**: Sprint phases implement Gate-Driven pattern: success gates declared in SKILL.md frontmatter as `success_gates: [...]`, verified by deterministic checks (tests, lints, compilation).
- **SEC-017**: `safetyGuardrails: false` requires `{ override: 'I understand the risks' }` else throws.
- **SEC-018**: Taste memory stores only `{ approved: boolean, dimensionKey: string, score: number, timestamp: number }` — no LLM free-text.
- **CON-013**: No gstack source code vendored. SKILL.md files are adapted MIT-licensed content; gstack binary/runtime NOT imported.
- **CON-014**: No running gstack installation required. Sprint skills are self-contained SKILL.md prompts.
- **CON-015**: No separate `@agentsy/caveman` or `@agentsy/superpowers` packages. `agentsy-features-v1.md` Phase 6 superseded.
- **GUD-016**: `autoplan` SKILL.md enforces Discrete Phase Separation: no tool writes during plan phase.
- **GUD-018**: SKILL.md files include `Implementation Notes` section. Phase completion emits structured discovery record to `.agents/tasks/<issue>/`.

### Phase AG1 — Package Scaffolding

| Task         | Description                                                                                                                                                                                                                                                                  | Completed | Date |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-AG1-001 | Create `packages/agents/`. Add `package.json` (`@agentsy/orchestrator/agents`, peerDeps: `@agentsy/core@workspace:*`, `@agentsy/memory@workspace:*`), `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`.                                                                 |           |      |
| TASK-AG1-002 | Define `AgentModeFactory<TOptions, TActivator>` interface in `packages/agents/src/types.ts`: `{ create(options?: TOptions): TActivator; name: string; description: string; skillCount(): number }`. Export `AgentMode` type union: `'caveman' \| 'superpowers' \| 'garrys'`. |           |      |
| TASK-AG1-003 | Create skill directory tree: `packages/agents/src/skills/caveman/`, `.../superpowers/`, `.../garrys/`.                                                                                                                                                                       |           |      |
| TASK-AG1-004 | Export stub barrel from `packages/agents/src/index.ts`.                                                                                                                                                                                                                      |           |      |
| TASK-AG1-005 | Add to turbo dependency graph and `pnpm-workspace.yaml`.                                                                                                                                                                                                                     |           |      |

### Phase AG2 — SKILL.md Files

| Task         | Description                                                                                                                                                                                                                                                                          | Completed | Date |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ---- |
| TASK-AG2-001 | Bundle JuliusBrussee/caveman v1.7.0 SKILL.md files: `caveman.md`, `caveman-lite.md`, `caveman-ultra.md`, `wenyan.md`, `cavecrew/investigator.md`, `cavecrew/builder.md`, `cavecrew/reviewer.md`. All include `source_url`, `version: "1.7.0"`, `license: "MIT"`. Add `_manifest.ts`. |           |      |
| TASK-AG2-002 | Bundle obra/superpowers v5.0.7 SKILL.md files: `brainstorming.md`, `git-worktrees.md`, `writing-plans.md`, `subagent-driven-development.md`, `tdd.md`, `code-review.md`, `finish-branch.md`. All include `source_url`, `version: "5.0.7"`, `license: "MIT"`. Add `_manifest.ts`.     |           |      |
| TASK-AG2-003 | Add `_manifest.ts` to `garrys/` exporting `GARRYS_SKILLS_VERSION = '1.26.0'` and `GARRYS_SOURCE_URL`.                                                                                                                                                                                |           |      |
| TASK-AG2-004 | Write `office-hours.md` — YC Office Hours: six forcing questions, three alternatives with effort estimates. `phase: "think"`.                                                                                                                                                        |           |      |
| TASK-AG2-005 | Write `plan-ceo-review.md` — four modes (Expansion/Hold/Reduction), 10-section review. `phase: "think"`.                                                                                                                                                                             |           |      |
| TASK-AG2-006 | Write `plan-eng-review.md` — ASCII diagrams, test matrix, edge cases, failure modes, security. `phase: "plan"`.                                                                                                                                                                      |           |      |
| TASK-AG2-007 | Write `review.md` — staff engineer review, auto-fixes obvious issues. `phase: "review"`.                                                                                                                                                                                             |           |      |
| TASK-AG2-008 | Write `ship.md` — sync main, run tests, audit coverage, push, open PR. `phase: "ship"`.                                                                                                                                                                                              |           |      |
| TASK-AG2-009 | Write `qa.md` — systematic test-and-fix loop, auto-generates regression test per bug. `phase: "test"`.                                                                                                                                                                               |           |      |
| TASK-AG2-010 | Write `cso.md` — OWASP Top 10 + STRIDE, 8/10+ confidence gate, exploit scenario per finding. `phase: "review"`.                                                                                                                                                                      |           |      |
| TASK-AG2-011 | Write `investigate.md` — Iron Law: no fixes without investigation. Stops after three failed attempts. `phase: "build"`.                                                                                                                                                              |           |      |
| TASK-AG2-012 | Write `autoplan.md` — pipeline: office-hours → plan-ceo-review → plan-eng-review in sequence. `phase: "think"`.                                                                                                                                                                      |           |      |

### Phase AG3 — Manager + Activator Implementations

| Task         | Description                                                                                                                                                                                                                         | Completed | Date |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-AG3-001 | Define `CavemanMode` (`'lite' \| 'full' \| 'ultra' \| 'wenyan-lite' \| 'wenyan-full' \| 'wenyan-ultra'`), `CavemanSkillManifest` in `caveman/types.ts`.                                                                             |           |      |
| TASK-AG3-002 | Implement `CavemanManager`: `activate(mode)`, `deactivate()`, `getActiveMode()`, `listSkills()`. Export `createCavemanManager()`.                                                                                                   |           |      |
| TASK-AG3-003 | Implement `caveman-shrink` MCP proxy as `packages/agents/bin/caveman-shrink.js`. Intercepts `tools/list`, compresses `description` only — never alters `inputSchema`. Add to `package.json` `"bin"`.                                |           |      |
| TASK-AG3-004 | Define `SuperpowersContext`, `SuperpowersSkillName`, `DEFAULT_SUPERPOWERS_CONTEXT` in `superpowers/types.ts`.                                                                                                                       |           |      |
| TASK-AG3-005 | Implement `SuperpowersActivator.selectSkills(context)`: `hasTestFiles → tdd`, `hasDiff → code-review`, `isOpenEndedPlan → brainstorming`, `requestedSkills` overrides. Export `createSuperpowersActivator()`.                       |           |      |
| TASK-AG3-006 | Define `GarrysSprintPhase`, `GarrysSkillName`, `GarrysSkillManifest`, `GarrysContext`, `GarrysOptions` in `garrys/types.ts`.                                                                                                        |           |      |
| TASK-AG3-007 | Implement `detectPhase(context)`: `hasDiff && !hasTestFailures → review`; `hasTestFailures → test`; `isProductQuestion → think`; `hasSecurityConcern → review`; explicit `sprintPhase` overrides all.                               |           |      |
| TASK-AG3-008 | Implement `selectSkills(phase)` ≤3 skills. Map: `think → [office-hours, plan-ceo-review, autoplan]`; `plan → [plan-eng-review]`; `build → [investigate]`; `review → [review, cso]`; `test → [qa]`; `ship → [ship]`; `reflect → []`. |           |      |
| TASK-AG3-009 | Implement `createCheckpointHook({ projectRoot })` in `garrys/checkpoint.ts`. `postTurnHook`: `git add -A && git commit -m "WIP: <summary>"` with `[gstack-context]` body. Silently emits `CheckpointUnavailable` if git not found.  |           |      |
| TASK-AG3-010 | Implement `createSafetyGuardrailHook()` in `garrys/guardrails.ts`. Matches `DESTRUCTIVE_PATTERNS`, emits `SafetyGuardrailTriggered`, returns `'ask'`. `safetyGuardrails: false` requires override string (SEC-017).                 |           |      |
| TASK-AG3-011 | Implement `createTasteMemory({ projectId, tasteProfilePath? })` in `garrys/taste.ts`. `record()`, `getProfile()`, `decay()` (×0.95). Writes via `@agentsy/memory`. SEC-018 — no free-text stored.                                   |           |      |
| TASK-AG3-012 | Implement `GarrysActivator`: `detectPhase`, `selectSkills`, `getSkillContent(name)`, `listSkills()`. Reads SKILL.md from `src/skills/garrys/` at module init.                                                                       |           |      |
| TASK-AG3-013 | Implement `createGarrysAgent(options?)` factory returning `{ activator, checkpointHook?, safetyHook?, tasteMemory? }`.                                                                                                              |           |      |
| TASK-AG3-014 | Export all public symbols from `packages/agents/src/index.ts`.                                                                                                                                                                      |           |      |

### Phase AG4 — Tests

| Task         | Description                                                                                                                        | Completed | Date |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-AG4-001 | `caveman/manager.test.ts`: `activate('full')` non-empty; `ultra` shorter than `lite`; cavecrew variants listed; frontmatter valid. |           |      |
| TASK-AG4-002 | `superpowers/activator.test.ts`: context signal → skill mapping (4 cases); `requestedSkills` override.                             |           |      |
| TASK-AG4-003 | `garrys/activator.test.ts`: phase detection (5 cases); `selectSkills` ≤3 per phase.                                                |           |      |
| TASK-AG4-004 | `garrys/guardrails.test.ts`: destructive pattern triggers (≥5 patterns); non-destructive passes; override enforcement.             |           |      |
| TASK-AG4-005 | `garrys/taste.test.ts`: `record`, `getProfile`, `decay`, SEC-018 shape constraint.                                                 |           |      |
| TASK-AG4-006 | `agents.test.ts`: all three factories satisfy `AgentModeFactory` interface.                                                        |           |      |
| TASK-AG4-007 | `skills.test.ts`: all 23 bundled SKILL.md files have `source_url`, `version`, `license`; garry's files contain no gstack CLI refs. |           |      |

### Phase AG5 — Documentation

| Task         | Description                                                                                                                                                     | Completed | Date |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-AG5-001 | Create `docs/developers/custom-agents.md`. Section 1: `AgentModeFactory` pattern, SKILL.md bundling, context-signal activation, `AgentLoopOptions` integration. |           |      |
| TASK-AG5-002 | Section 2: Caveman mode — mode switching, SKILL.md injection, `caveman-shrink` MCP proxy config. Attribution: JuliusBrussee/caveman.                            |           |      |
| TASK-AG5-003 | Section 3: Superpowers mode — context signal detection, `selectSkills(context)`, wiring into `AgentLoopOptions.systemPrompt`. Attribution: obra/superpowers.    |           |      |
| TASK-AG5-004 | Section 4: Garry's mode — phase detection, `selectSkills(phase)`, checkpoint + safety + taste memory integration. Attribution: garrytan/gstack.                 |           |      |
| TASK-AG5-005 | Section 5: Build your own — minimal 30-line template.                                                                                                           |           |      |
| TASK-AG5-006 | Add `custom-agents` entry to `docs/developers/index.md`.                                                                                                        |           |      |

### Dependencies

- **DEP-012**: `@agentsy/core@workspace:*` — only required runtime dep
- **DEP-013**: `@agentsy/memory@workspace:*` — peer dep for garry's taste memory only
- **DEP-014**: JuliusBrussee/caveman v1.7.0 — SKILL.md static assets, MIT, no runtime import
- **DEP-015**: obra/superpowers v5.0.7 — SKILL.md static assets, MIT, no runtime import
- **DEP-016**: garrytan/gstack v1.26.0 — SKILL.md methodology, MIT, no runtime import

### Risks

- **RISK-AG-001**: gstack SKILL.md files may need wording adaptation to avoid verbatim reproduction. Adapt language; preserve attribution frontmatter.
- **RISK-AG-002**: Checkpoint mode requires `git` in PATH. `createCheckpointHook` detects missing git silently, emits `CheckpointUnavailable`.

## Role in Framework Ecosystem

`@agentsy/orchestrator` is the **conductor** of the framework. While `@agentsy/runtime` handles the execution of a single agent loop, the orchestrator coordinates multiple agents, tools, and human-in-the-loop gates into a coherent workflow.

It defines the `WorkflowSpec`, `OrchestrationEngine`, and the scheduler that drives complex multi-step execution: sequential, parallel, conditional, and timed.

### Ecosystem Sketch

```text
[ User Application / VS Code / CLI ]
         |
         v
[ @agentsy/orchestrator ] <--- COORDINATION & ROUTING
         |
         +-----------------------+-----------------------+
         |                       |                       |
         v                       v                       v
[ @agentsy/runtime ]    [ @agentsy/runtime ]    [ @agentsy/runtime ]
(Agent A Loop)          (Agent B Loop)          (Agent C Loop)
         |                       |                       |
         +-----------+-----------+-----------+-----------+
                     |
                     v
             [ @agentsy/core ]
```

## Fulfillment of Role

The package fulfills its role by implementing a graph-based workflow engine that supports:

1. **Intelligent Decomposition**: Breaking goals into subtasks.
2. **Resource Allocation**: Matching agents to tasks based on skills and capacity.
3. **Execution Coordination**: Managing concurrent execution with dependency resolution.
4. **Adaptive Scheduling**: Optimizing for speed, cost, and quality (Orloj pattern).

## Detailed Functionality

### 1. Workflow Spec (`src/workflow/`)

- **Graph-Based Model**: Pregel-inspired architecture using `StateGraph` for defining nodes and edges.
- **WorkflowNode**: The atomic unit of work. Types include:
  - `agent`: Dispatches to an `@agentsy/runtime` loop.
  - `tool`: Executes a standalone tool.
  - `decision`: A branch node with conditional logic and routing.
  - `parallel`: Spawns multiple child nodes concurrently with barrier synchronization.
  - `loop`: Repeats nodes until a condition is met.
  - `human`: A human-in-the-loop interruptible execution point for feedback or approval.
  - `planning`: A dedicated step for generating task plans.
  - `subagent`: Parent-child subagent spawning with max depth cap (REQ-014).
- **Superstep Execution**: Vertex-based computation model where nodes process messages and state in discrete steps.

### 2. Orchestration Engine (`src/engine/`)

- **Responsibility**: State management of active workflows.
- **Mechanism**: `OrchestrationEngine` with explicit state versioning and checkpointing.
- **Control Flow**: Conditional routing, parallel execution, and dynamic graph modification.
- **Human-in-the-Loop**: Support for `pause-for-feedback` and `resume-from-checkpoint` capabilities.
- **Hook Points**: Injection points for `beforeStep`, `afterStep`, `beforeToolCall`, `afterToolCall`, `onError`, `onAbort` (REQ-004).
- **Memory Lifecycle**: Automatic triggers for `memoryEngine.startTask()` and `memoryEngine.endTask()` (REQ-005).

### 2.1 Coordination patterns worth preserving

The orchestrator should remain deterministic and code-first. The best external references are Bernstein for repeatable scheduling, Rivet for actor-like graph execution, and Yao for lifecycle interception.

- **Bernstein-style scheduler**: do not let the model decide every coordination step; keep decomposition and retry logic observable and replayable.
- **Rivet-style graph execution**: model work as explicit nodes, edges, and state transitions so concurrent paths stay inspectable.
- **Yao-style hooks**: keep pre/post interception points narrow and predictable so policies, memory lifecycle, and analytics can attach cleanly.
- **Progressive disclosure for skills**: keep role-specific instructions compact at startup and load the full body only when a phase actually needs it.

### 3. Scheduler (`src/scheduler/`)

- **Mechanism**: Timing-wheel scheduler (Orloj pattern).
- **Responsibility**: Deterministic task execution and timeout management.
- **Invariants**: Must be deterministic under concurrent task submissions.

### 4. Execution Loops

- **ReAct Loop**: Sequential `Initialize -> Plan -> Act -> Observe -> Synthesize` cycle.
- **Multi-Step Coordination**: Managing `maxSteps` and `planningInterval` to maintain task focus.
- **StopCondition**: Async predicates for loop termination (`isStepCount(n)`, `hasToolCall()`, `isLoopFinished()`, `untilFinishReason`, `combineStrategies`) (REQ-023).
- **Dynamic Reconfiguration**: `prepareStep` callback and `mergeCallbacks` utility for per-step adjustments (REQ-024).

### 4.1 External interoperability targets

Where possible, orchestration outputs should stay compatible with the broader agent ecosystem:

- **MCP** for tool execution and resource access.
- **A2A** for cross-agent task handoff when another system needs to take over a sub-goal.
- **ACP** for editor/client integrations that only need a typed remote-agent surface.
- **A2UI** for structured, declarative UI payloads produced during approval or review flows.

## Logic & Data Flow

### 1. Workflow Execution Flow

1. `OrchestrationEngine.run(spec, input)` is called.
2. The engine identifies the `entryNode`.
3. For each active node:
   - The engine prepares the node input (resolving data from previous steps).
   - The engine dispatches the task to the appropriate executor (Agent, Tool, etc.).
   - Upon completion, the engine evaluates `WorkflowEdges` to find the next node(s).
4. The workflow finishes when an exit node is reached or a terminal error occurs.

### 2. Coordination Patterns

- **Gas Town**: Message-based routing between autonomous agents.
- **Rivet**: Node-based graph composition for structured pipelines.
- **Bernstein**: Event-driven reactive orchestration.
- **Orloj**: Time-based scheduling and resource pooling.
- **Evaluator-Optimizer**: Generate response -> evaluate against rubric -> provide feedback -> regenerate.
- **Provider Strategy**: Capability matrix (vision, tools, etc.) and configurable fallback chains (REQ-013).

## Key Interfaces

### OrchestrationEngine

```typescript
export interface OrchestrationEngine {
  createWorkflow(spec: WorkflowSpec): Workflow;
  runWorkflow(workflow: Workflow, input: unknown): Promise<WorkflowResult>;
  pauseWorkflow(workflowId: WorkflowId): Promise<void>;
  resumeWorkflow(workflowId: WorkflowId): Promise<WorkflowResult>;
  getWorkflowState(workflowId: WorkflowId): WorkflowState;
}
```

### WorkflowSpec

```typescript
export interface WorkflowSpec {
  id: string;
  name: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  entryNodeId: string;
  maxIterations?: number;
}
```

## Implementation Details

### Boundary Enforcement

`@agentsy/orchestrator` must not import from `@agentsy/runtime` or vice versa. The orchestrator defines the interfaces that runtimes must implement, and the runtime handles the specific execution logic for a single agent turn.

### Observability

Every workflow step emits an `OrchestrationSpan` to `@agentsy/observability`. Spans are linked by a workflow-level trace ID, allowing for full execution visualization.

## Sources Synthesized

`agentsy-scheduler-v1.md`, `agentsy-agents-v1.md`, `agentsy-tech.md`, `DECISION-LOG.md`, `implementation-plan.md`, `packages/orchestrator/IMPLEMENTATION-PLAN.md`.

```text
// Rivet-inspired dependency resolution
dependencies: {
resolver: DependencyResolver;
scheduler: DependencyScheduler;
executor: DependencyExecutor;
tracker: DependencyTracker;
};

// Adaptive optimization
optimization: {
optimizer: WorkflowOptimizer;
balancer: LoadBalancer;
tuner: PerformanceTuner;
predictor: PerformancePredictor;
};
}

```

### 5. Execution Coordination

```typescript
interface ExecutionCoordinator {
  // Rivet-inspired coordination
  coordination: {
    executor: NodeExecutor;
    synchronizer: NodeSynchronizer;
    aggregator: ResultAggregator;
    validator: ResultValidator;
  };

  // Bernstein-inspired event system
  events: {
    emitter: EventEmitter;
    listener: EventListener;
    filter: EventFilter;
    router: EventRouter;
  };

  // State management
  state: {
    manager: StateManager;
    persistence: StatePersistence;
    recovery: StateRecovery;
    rollback: RollbackManager;
  };

  // Communication
  communication: {
    messenger: MessageMessenger;
    channel: MessageChannel;
    router: MessageRouter;
    serializer: MessageSerializer;
  };
}
```

### 6. Fault Tolerance & Recovery

```typescript
interface RecoveryManager {
  // Error handling
  errors: {
    detector: ErrorDetector;
    classifier: ErrorClassifier;
    handler: ErrorHandler;
    reporter: ErrorReporter;
  };

  // Retry strategies
  retry: {
    policy: RetryPolicy;
    executor: RetryExecutor;
    backoff: BackoffStrategy;
    circuit: CircuitBreaker;
  };

  // Failover
  failover: {
    detector: FailoverDetector;
    switcher: FailoverSwitcher;
    recovery: FailoverRecovery;
    validation: FailoverValidation;
  };

  // Resilience patterns
  resilience: {
    bulkhead: BulkheadPattern;
    timeout: TimeoutPattern;
    caching: CachePattern;
    throttling: ThrottlingPattern;
  };
}
```

### Advanced Features

#### 1. Intelligent Task Decomposition

```typescript
interface TaskDecomposer {
  // AI-powered decomposition
  aiDecomposer: {
    analyzer: TaskAnalyzer;
    planner: TaskPlanner;
    estimator: EffortEstimator;
    optimizer: PathOptimizer;
  };

  // Pattern-based decomposition
  patternDecomposer: {
    recognizer: PatternRecognizer;
    matcher: PatternMatcher;
    adapter: PatternAdapter;
    executor: PatternExecutor;
  };

  // Hierarchical planning
  hierarchicalPlanner: {
    decomposer: HierarchicalDecomposer;
    planner: HierarchicalPlanner;
    executor: HierarchicalExecutor;
    monitor: HierarchicalMonitor;
  };
}
```

#### 2. Dynamic Resource Allocation

```typescript
interface ResourceAllocator {
  // Real-time allocation
  realTimeAllocator: {
    monitor: ResourceMonitor;
    analyzer: ResourceAnalyzer;
    allocator: DynamicAllocator;
    optimizer: ResourceOptimizer;
  };

  // Predictive scaling
  predictiveScaler: {
    predictor: DemandPredictor;
    scaler: AutoScaler;
    optimizer: ScalingOptimizer;
    controller: ScalingController;
  };

  // Cost optimization
  costOptimizer: {
    estimator: CostEstimator;
    optimizer: CostOptimizer;
    tracker: CostTracker;
    reporter: CostReporter;
  };
}
```

#### 3. Result Synthesis

```typescript
interface ResultSynthesizer {
  // Aggregation strategies
  aggregation: {
    collector: ResultCollector;
    aggregator: ResultAggregator;
    validator: ResultValidator;
    normalizer: ResultNormalizer;
  };

  // Conflict resolution
  conflictResolution: {
    detector: ConflictDetector;
    resolver: ConflictResolver;
    mediator: ConflictMediator;
    validator: ConflictValidator;
  };

  // Quality assurance
  qualityAssurance: {
    validator: QualityValidator;
    scorer: QualityScorer;
    improver: QualityImprover;
    reporter: QualityReporter;
  };
}
```

### Implementation Phases

#### Phase 1: Core Orchestration Engine

```bash
# Basic orchestration infrastructure
src/
  core/
    engine.ts          # OrchestrationEngine implementation
    registry.ts        # AgentRegistry
    scheduler.ts       # TaskScheduler
    coordinator.ts     # ExecutionCoordinator
  types/
    orchestrator.ts    # Core type definitions
    workflow.ts        # Workflow types
    agent.ts          # Agent types
    task.ts           # Task types
  utils/
    matching.ts       # Skill matching utilities
    timing.ts         # Timing utilities
    serialization.ts  # Message serialization
```

#### Phase 2: Workflow System

```bash
# Workflow definition and execution
src/
  workflow/
    builder.ts        # WorkflowBuilder
    executor.ts       # WorkflowExecutor
    monitor.ts        # WorkflowMonitor
    nodes/           # Node implementations
      task.ts
      decision.ts
      parallel.ts
      sequence.ts
      merge.ts
    graph/           # Graph algorithms
      analyzer.ts
      optimizer.ts
      validator.ts
```

#### Phase 3: Agent Discovery

```bash
# Agent registry and discovery
src/
  agents/
    discovery.ts      # AgentDiscovery
    capabilities.ts  # AgentCapabilities
    registry.ts       # AgentRegistry
    matching.ts       # AgentMatching
    monitoring.ts     # AgentMonitoring
  skills/
    taxonomy.ts       # SkillTaxonomy
    matching.ts       # SkillMatching
    affinity.ts       # SkillAffinity
  resources/
    tracker.ts        # ResourceTracker
    allocator.ts      # ResourceAllocator
    optimizer.ts      # ResourceOptimizer
```

#### Phase 4: Fault Tolerance

```bash
# Resilience and recovery
src/
  resilience/
    recovery.ts       # RecoveryManager
    retry.ts         # RetryEngine
    failover.ts      # FailoverManager
    circuit.ts       # CircuitBreaker
  monitoring/
    health.ts        # HealthMonitor
    metrics.ts       # MetricsCollector
    alerts.ts        # AlertManager
    tracing.ts       # DistributedTracing
```

#### Phase 5: Advanced Features

```bash
# Intelligent orchestration
src/
  intelligence/
    decomposer.ts     # TaskDecomposer
    optimizer.ts      # WorkflowOptimizer
    predictor.ts      # PerformancePredictor
    synthesizer.ts    # ResultSynthesizer
  communication/
    messaging.ts      # MessageSystem
    events.ts         # EventSystem
    channels.ts       # CommunicationChannels
  visualization/
    graph.ts          # WorkflowVisualization
    dashboard.ts      # OrchestrationDashboard
    insights.ts       # PerformanceInsights
```

### Usage Examples

#### 1. Simple Workflow Definition

```typescript
const workflow = new WorkflowBuilder()
  .name("Code Review Orchestration")
  .requireSkill("code-analysis")
  .requireSkill("security-review")

  .sequence([
    new TaskNode("analyze", {
      agent: "code-analyzer",
      input: "code-changes",
    }),
    new ParallelNode([
      new TaskNode("security", {
        agent: "security-reviewer",
        input: "analysis-results",
      }),
      new TaskNode("quality", {
        agent: "quality-reviewer",
        input: "analysis-results",
      }),
    ]),
    new MergeNode("combine"),
    new TaskNode("report", {
      agent: "report-generator",
      input: "combined-results",
    }),
  ])

  .timeout(Duration.minutes(30))
  .retry(RetryPolicy.exponential(3))
  .build();
```

#### 2. Dynamic Agent Discovery

```typescript
const registry = new AgentRegistry()
  .register("code-analyzer", {
    skills: ["typescript", "security", "performance"],
    capacity: 10,
    cost: 0.001,
  })
  .register("security-reviewer", {
    skills: ["security", "vulnerability-scanning"],
    capacity: 5,
    cost: 0.002,
  })
  .discover("local://agents")
  .discover("remote://production-agents");
```

#### 3. Orchestration Execution

```typescript
const orchestrator = new OrchestrationEngine({
  registry,
  scheduler: new AdaptiveScheduler(),
  coordinator: new AsyncCoordinator(),
});

const result = await orchestrator.execute(workflow, {
  context: "code-review",
  resourceLimits: { maxAgents: 5, maxCost: 0.01 },
  monitoring: true,
  recovery: true,
});
```

### Verification Criteria

- [ ] Complex workflows execute correctly with proper coordination
- [ ] Agent discovery and registration works seamlessly
- [ ] Fault tolerance handles agent failures gracefully
- [ ] Dynamic resource allocation optimizes for cost and speed
- [ ] Result synthesis produces coherent outputs
- [ ] Monitoring and observability provide actionable insights
- [ ] Performance scales to hundreds of concurrent workflows
- [ ] Integration with subagents and a2a protocols works

### Risk Register

- **High**: Complexity of distributed orchestration
- **Medium**: Agent discovery and registration reliability
- **Medium**: Workflow state management consistency
- **Low**: Performance overhead from coordination layer
- **Low**: Resource allocation efficiency
- **Low**: Result synthesis quality

### Integration Points

- **subagents**: Orchestrate local agent execution
- **a2a**: Coordinate remote agent communication
- **runtime**: Use runtime engine for task execution
- **session**: Persist workflow state
- **memory**: Store workflow learning and optimization
- **tokens**: Track resource consumption and costs

This orchestrator provides a sophisticated, production-ready system for coordinating complex multi-agent workflows with intelligent resource allocation, fault tolerance, and adaptive optimization.

---

## @agentsy/slash-commands — Slash Command Registry (Phase 5)

### Requirements

- **REQ-033**: `SlashCommandRegistry` discovers, resolves, and executes `/`-prefixed commands from SKILL.md files.
- **REQ-034**: SKILL.md frontmatter supports: `allowed-tools`, `description`, `model`, `argument-hint`.
- **REQ-035**: Stock slash commands: `/compact`, `/status`, `/new`, `/review`, `/skills-find`, `/skills-add`, `/skills-list`, `/mcp-list`, `/mcp-install`, `/caveman`, `/caveman-lite`, `/caveman-ultra`.
- **GUD-009**: All 12 stock slash commands must have unit tests.
- **ALT-011**: Rejected — slash commands as MCP tools. Rationale: slash commands are user-facing text triggers, not model tool-use; mixing them with MCP tools creates protocol confusion.
- **TASK-F5-015**: Add `@agentsy/slash-commands` and `@agentsy/skills` to turbo dependency graph.

### Types (`src/types.ts`)

```ts
interface SlashCommandManifest {
  name: string; // without leading slash
  description: string;
  allowedTools?: string[];
  model?: string;
  argumentHint?: string;
  skillPath: string;
}
```

### Implementation Tasks

| Task        | Description                                                                                                                                                                                                                                     |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TASK-F5-001 | Create `packages/slash-commands/`. Add `package.json` (`@agentsy/slash-commands`, peerDep: `@agentsy/core@workspace:*`), `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`.                                                                 |
| TASK-F5-002 | Define `SlashCommandManifest` interface in `packages/slash-commands/src/types.ts`.                                                                                                                                                              |
| TASK-F5-003 | Implement `SlashCommandRegistry` in `packages/slash-commands/src/registry.ts`. Methods: `discover(dir: string): Promise<void>`, `get(name: string): SlashCommandManifest \| undefined`, `execute(name: string, args: string): Promise<string>`. |
| TASK-F5-004 | Implement SKILL.md frontmatter YAML parser in `packages/slash-commands/src/parser.ts`. Parse `---` delimited blocks from `.md` files.                                                                                                           |
| TASK-F5-005 | Create stock SKILL.md files: `/compact.md`, `/status.md`, `/new.md`, `/review.md` in `packages/slash-commands/src/skills/`.                                                                                                                     |
| TASK-F5-006 | Export `createSlashCommandRegistry()` factory from `packages/slash-commands/src/index.ts`.                                                                                                                                                      |
| TASK-F5-007 | Tests in `packages/slash-commands/src/registry.test.ts`: `discover()` finds all SKILL.md files, `get()` resolves by name, `execute()` returns body content, unknown command returns undefined.                                                  |

---

## @agentsy/superpowers — Skill Auto-Activation (Phase 6)

### Requirements

- **REQ-028**: `SuperpowersActivator` selects relevant SKILL.md bundles based on project context (test files present → TDD, diff present → code-review, open-ended plan → brainstorming).
- **GUD-008**: All bundled SKILL.md files must include `source_url`, `version`, `license` frontmatter.
- **ASSUMPTION-008**: obra/superpowers v5.0.7 SKILL.md files are MIT licensed and redistributable. Verify before TASK-F6-014.
- **DEP-010**: obra/superpowers v5.0.7 SKILL.md files — bundled as static assets. MIT license.

### Types (`src/types.ts`)

```ts
interface SuperpowersContext {
  hasTestFiles?: boolean;
  hasDiff?: boolean;
  isOpenEndedPlan?: boolean;
  requestedSkills?: string[];
  projectRoot?: string;
}
interface SkillManifest {
  name: string;
  content: string;
  source_url: string;
  version: string;
  license: string;
}
```

### Auto-Activation Rules

| Condition               | Activated Skill |
| ----------------------- | --------------- |
| `hasTestFiles: true`    | `tdd`           |
| `hasDiff: true`         | `code-review`   |
| `isOpenEndedPlan: true` | `brainstorming` |

### Implementation Tasks

| Task        | Description                                                                                                                                                                                                                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TASK-F6-013 | Create `packages/superpowers/`. Add `package.json` (`@agentsy/superpowers`, peerDep: `@agentsy/core@workspace:*`), `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`.                                                                                                                         |
| TASK-F6-014 | Bundle obra/superpowers v5.0.7 skills under `packages/superpowers/src/skills/`: `brainstorming.md`, `git-worktrees.md`, `writing-plans.md`, `subagent-driven-development.md`, `tdd.md`, `code-review.md`, `finish-branch.md`. Each with `source_url`, `version`, `license` frontmatter (GUD-008). |
| TASK-F6-015 | Implement `SuperpowersActivator` in `packages/superpowers/src/activator.ts`. Method: `selectSkills(context: SuperpowersContext): SkillManifest[]`. Apply auto-activation rules table.                                                                                                             |
| TASK-F6-016 | Define `SuperpowersContext` and `SkillManifest` in `packages/superpowers/src/types.ts`.                                                                                                                                                                                                           |
| TASK-F6-017 | Export `createSuperpowersActivator()` factory from `packages/superpowers/src/index.ts`.                                                                                                                                                                                                           |
| TASK-F6-018 | Tests in `packages/superpowers/src/activator.test.ts`: `hasTestFiles → tdd`, `hasDiff → code-review`, `isOpenEndedPlan → brainstorming`, `requestedSkills` override, empty context returns empty array.                                                                                           |
| TASK-F6-019 | Update `/skills-find` and `/skills-add` SKILL.md bodies to include superpowers discovery commands.                                                                                                                                                                                                |

---

## Agent Loop Slash Command Integration (Phase 9)

### Requirements

- **REQ-036**: Agent loop intercepts `/`-prefixed messages before model invocation when `slashCommands` option is provided.
- **REQ-037**: Non-matching `/`-prefixed messages pass through to the model unchanged.
- **REQ-101**: `planAndExecute` mode — agent loop produces a plan artifact before tool calls, subject to `planApproval` hook. Plan must be inspectable JSON with `steps[]`, `dependencies{}`, `successCriteria[]`, `escalationPoints[]` (GUD-020).
- **REQ-102**: `ActionTrace` event emitted for every tool call: `{ toolName, args, result, durationMs, turnIndex }`. Consumers register `onActionTrace` handlers.
- **REQ-108**: `humanInTheLoop` approval hook for destructive tool calls. Pauses execution; emits `AwaitingHumanApproval` event.
- **CON-023**: Explicit stop conditions required: `maxIterations`, `maxToolCalls`, `stopOnTestFailureCount`. Unbounded loops are a build error.
- **GUD-013**: Validate a single LLM call is insufficient before building a multi-agent system.
- **GUD-014**: Tool definitions require the same engineering effort as system prompts (ACI principle).
- **GUD-015**: Each package invoking the agent loop must have an `AGENTS.md` under 200 lines.
- **GUD-017**: Agent action APIs must be idempotent; non-idempotent operations wrapped in confirmation gate.
- **GUD-019**: All tool calls must be schema-driven, time-bounded, observable, and classified as `retryable | non-retryable`.
- **GUD-020**: Plans from `planAndExecute` must be inspectable JSON artifacts.
- **SEC-026**: Lethal Trifecta — code paths combining (1) private data + (2) untrusted external content + (3) network egress must break at least one condition. Audit all `planAndExecute` tool chains.
- **ALT-011**: Rejected — slash commands as MCP tools. See @agentsy/slash-commands rationale above.
- **RISK-015**: Slash command execution could trigger unintended agent loop re-entrancy. Mitigation: slash command execution returns synthetic assistant message; agent loop does not recurse.
- **TEST-009**: E2E tests in `packages/orchestrator/src/agent.test.ts` — slash commands intercepted, non-matching pass through, `planAndExecute` artifact shape.

### Types additions to `AgentLoopOptions` (`src/types.ts`)

```ts
interface AgentLoopOptions {
  // ... existing fields ...
  slashCommands?: SlashCommandRegistry; // TASK-F9-001
  planAndExecute?: boolean; // REQ-101
  planApproval?: (plan: PlanArtifact) => Promise<boolean>; // REQ-101
  onActionTrace?: (trace: ActionTrace) => void; // REQ-102
  humanInTheLoop?: (call: ToolCall) => Promise<boolean>; // REQ-108
  maxIterations?: number; // CON-023
  maxToolCalls?: number; // CON-023
  stopOnTestFailureCount?: number; // CON-023
}

interface ActionTrace {
  toolName: string;
  args: unknown;
  result: unknown;
  durationMs: number;
  turnIndex: number;
}
interface PlanArtifact {
  steps: string[];
  dependencies: Record<string, string[]>;
  successCriteria: string[];
  escalationPoints: string[];
}
```

### Implementation Tasks

| Task        | Description                                                                                                                                                                                                                                                                      |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TASK-F9-001 | Add `slashCommands?: SlashCommandRegistry`, `planAndExecute?`, `planApproval?`, `onActionTrace?`, `humanInTheLoop?`, `maxIterations?`, `maxToolCalls?`, `stopOnTestFailureCount?` to `AgentLoopOptions` in `packages/orchestrator/src/types.ts`.                                 |
| TASK-F9-002 | Implement slash command interception in `packages/orchestrator/src/createAgentLoop.ts`. If user message starts with `/`, extract command + args, call `slashCommands.execute()`, return as synthetic assistant message. Non-matching pass through to model. No loop re-entrancy. |
| TASK-F9-003 | Implement `planAndExecute` mode. Before tool calls, generate JSON plan artifact. If `planApproval` hook defined, pause and await resolution. Emit plan as `PlanArtifact` typed event.                                                                                            |
| TASK-F9-004 | Implement `ActionTrace` emission for every tool call. Call `onActionTrace` after each tool result if handler defined.                                                                                                                                                            |
| TASK-F9-005 | Implement `humanInTheLoop` hook. Classify tool calls as destructive based on tool metadata flag. Pause agent loop, emit `AwaitingHumanApproval`, resume on `true` or abort on `false`.                                                                                           |
| TASK-F9-006 | E2E tests in `packages/orchestrator/src/agent.test.ts`: slash command intercept, non-matching passthrough, `planAndExecute` artifact shape, `maxIterations` stop condition enforced.                                                                                             |

---

## Task Scheduler Module (migrated from `plan/agentsy-scheduler-v1.md`)

Instead of creating a standalone `@agentsy/scheduler` package, scheduler capabilities are planned as an orchestrator module integrated with existing packages.

### Scheduler requirements

- Support task types: `once`, `recurring`, `immediate`.
- Deterministic task IDs via UUID v5 from canonical fingerprint (`taskName + ownerId + scheduleSignature`) for idempotent scheduling.
- Persist tasks before returning from `schedule()`; on restart, restore pending tasks and re-register.
- Prefer a local SQLite-backed store when available, using honker queue and time-trigger scheduling primitives as the execution substrate.
- Expose consumer-selectable persistence backends: honker/SQLite (preferred local-first), PostgreSQL, and plaintext/file-backed local storage.
- Expose consumer-selectable scheduling drivers: honker time-trigger scheduling (preferred when available), cron-compatible scheduling, and in-process immediate/interval fallback.
- Run each scheduled task as isolated `createAgentLoop` invocation with fresh context.
- Enforce execution timeout (default 5m), retry policy (default 3), and task suspension after retry exhaustion.
- Expose scheduler tools for MCP/local registration: `schedule_task`, `cancel_task`, `list_tasks`.
- Enforce cron-expression validation and prompt sanitization before execution.

### Scheduler ownership clarification

- `@agentsy/orchestrator` owns task semantics, task state machine, dependency graph, checklist/todo state, and lane/circuit-breaker policy.
- honker/SQLite provides durable queueing, locking, retries, and time-trigger scheduling when available.
- If honker/SQLite is unavailable, orchestrator may fall back to PostgreSQL-backed persistence or a plaintext/file local mode with reduced concurrency guarantees.
- Cron-compatible scheduling should be treated as a driver option beneath orchestrator policy, not a separate task-manager owner.
- Remote sync must remain optional; the authoritative scheduler path is local-first.

### Additional requirements integrated

- **REQ-105**: Agent Circuit Breaker — open after threshold of failures within a sliding window, pause execution, manual reset.
- **REQ-106**: Lane-Based Execution Queue — per-lane concurrency limits to prevent starvation.
- **REQ-107**: Background-to-foreground handoff — immediate proactive delivery for active sessions, queued delivery for inactive sessions.

### Planned module layout (within orchestrator)

```text
packages/orchestrator/src/scheduler/
  types.ts
  parser.ts
  task-id.ts
  scheduler.ts
  runner.ts
  tools.ts
  backends/
    sqlite-honker.ts
    postgres.ts
    plaintext.ts
  drivers/
    honker.ts
    cron.ts
    interval.ts
  circuit-breaker.ts
  lane-queue.ts
  handoff.ts
```

### Security notes

- **SEC-022**: Task prompts treated as untrusted; sanitize with `stripXmlContextTags` + `dedupeXmlContext`.
- **SEC-023**: Schedule parsing output must pass strict schema validation; never fall back to raw text.
- **SEC-024**: Validate direct cron expressions against safe regex before scheduling.
- **SEC-027**: Enforce Lethal Trifecta mitigations for scheduled task agents (no cross-user data, sanitized prompts, optional egress allowlist).

### Dependencies

- `node-schedule@^2` (peer) for in-process scheduling.
- `proper-lockfile@^4` for file-backed store locking (if using file store integration).
- `uuid@^9` for UUID v5 task IDs.
- Existing `@agentsy/core`, `@agentsy/session`, and `@agentsy/connectors` integration points.
- honker-backed SQLite queue/scheduler primitives from the local coordination stack when available.
- PostgreSQL driver/adapter for durable multi-process task persistence when consumers opt in.
- Cron-compatible scheduler support for consumer environments that standardize on cron semantics.

---

## Default Agent Tool Suite (migrated from `plan/agentsy-standalone-v1.md` STD8)

Plan and keep as orchestrator-level defaults (with package-boundary-safe implementation):

- **fileBrowser**: use `fd` when available, fallback to recursive `fs` traversal.
- **fileEditor**: `readFile`, `writeFile`, `patchFile`; use `sd` when available, fallback to safe in-process replace.
- **lintFormat**: run `ultracite` subprocess with `shell: false` and structured diagnostics parsing.
- **gitTool**: use `simple-git` as runtime dependency.
- **webBrowser**: wrap `agent-browser` subprocess with `shell: false` and content-boundary env guard.
- **webSearch**: pure data-shaping Anthropic web-search tool definition helpers.

### Safety constraints for default tools

- Path traversal rejection against configured workspace root.
- Regex safety checks for `patchFile` (`find` length bound + unsafe pattern guard + try/catch compile).
- No shell interpolation for any subprocess tool (literal argument arrays only).
- Optional peer dependency detection with descriptive install hints for missing CLIs.

### Import/packaging policy

- Keep these as tree-shakeable, individually importable tool modules.
- Preserve deterministic behavior and typed input schemas.

---

## Alignment Snapshot (migrated from `plan/alignment-report-5-11-26.md`)

- Orchestrator ownership boundary is confirmed complete: lifecycle hooks, stop conditions, tool approval, and scheduler integration belong in `@agentsy/orchestrator`.
- Cross-doc consistency noted in source report: `MASTER-IMPLEMENTATION-PLAN`, `DECISION-LOG`, and `PACKAGE-NAMING-MAP` were aligned at snapshot time.
- Consumer package audit note preserved: no legacy import paths should be reintroduced.

---

## Legacy Master Phase Map (migrated from `plan/implementation-plan.md`)

Historical phase map retained for context:

- Phase 0: close DX blockers before broad consolidation.
- Phase C-1: core consolidation wave (completed historically).
- Phase C-2/C-3/C-4: providers, AG-UI/runtime path, and agent→orchestrator migration waves.
- F-series implementation streams: orchestrator, runtime, providers, tokens, memory, session, mcp, plugins, connectors, testing, security.

### Locked boundary decisions retained

- `scheduler` belongs under orchestrator.
- `agent` responsibilities belong under orchestrator agent loop boundaries.
- Runtime, providers, and tokens have their own package authority boundaries.
- Migration strategy is direct cutover with import rewrites (no wrapper aliases).

### Verification criteria retained

- Build success
- Typecheck success
- Test success
- Acyclic dependency graph
- Import path consistency

---

## Extracted Technical API Surface (from `plan/agentsy-tech.md`)

### Agent loop contracts

```typescript
type StopConditionState = {
  steps: StepResult[];
  messages: ModelMessage[];
  iterationCount: number;
  finishReason: string | null;
};

type StopCondition = (state: StopConditionState) => Promise<boolean> | boolean;

type PrepareStepFn = (
  step: StepState
) => Promise<Partial<AgentLoopOptions>> | Partial<AgentLoopOptions>;
```

### Required built-ins from technical design

- Stop factories: `isStepCount`, `isLoopFinished`, `hasToolCall`, `untilFinishReason`, `combineStrategies`.
- Per-step dynamic policy: `prepareStep` + `mergeCallbacks` behavior.
- Result contracts: `success | approval-required | stopped | error`.

### Ownership normalization from deprecated sections

- Historical standalone sections for `@agentsy/slash-commands`, `@agentsy/skills`, `@agentsy/superpowers`, `@agentsy/caveman` map to `@agentsy/plugins` extension domains.
- Scheduler remains under `@agentsy/orchestrator/src/scheduler` (no standalone scheduler package).
