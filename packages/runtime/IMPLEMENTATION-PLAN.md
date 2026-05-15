---
goal: @agentsy/runtime production implementation plan
version: 1.0
date_created: 2026-05-15
last_updated: 2026-05-15
owner: runtime-maintainers
status: In progress
tags: [feature, architecture, runtime, execution, approvals]
---

# Introduction

![Status: In progress](https://img.shields.io/badge/status-In%20progress-yellow)

This plan defines the production implementation order for `@agentsy/runtime` as the secure execution loop for agent turns and tool pathways.

## 1. Requirements & Constraints

- **REQ-RUNTIME-001**: Runtime loop supports streaming turns, tool lifecycle execution, and approval checkpoints.
- **REQ-RUNTIME-002**: Deny-by-default policy applies to high-impact operations.
- **REQ-RUNTIME-003**: Hook pipeline supports deterministic pre/post turn and tool lifecycle extension points.
- **REQ-RUNTIME-004**: Session snapshot/resume integration preserves deterministic runtime continuity.
- **REQ-RUNTIME-005**: Token budget enforcement fails closed on hard-limit breaches.
- **SEC-RUNTIME-001**: Sandbox pathways isolate side effects according to policy profile.
- **SEC-RUNTIME-002**: Approval and execution events are auditable with redacted payloads.
- **CON-RUNTIME-001**: Multi-step planning remains in `@agentsy/orchestrator`.
- **CON-RUNTIME-002**: Provider protocol mechanics remain in providers/core.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-RUNTIME-001: Contract and policy surface stabilization.

| Task             | Description                                                                     | Completed | Date |
| ---------------- | ------------------------------------------------------------------------------- | --------- | ---- |
| TASK-RUNTIME-001 | Stabilize runtime loop interfaces, state envelope, and policy hook contracts.   |           |      |
| TASK-RUNTIME-002 | Add compile-time and unit tests for approval and budget enforcement boundaries. |           |      |
| TASK-RUNTIME-003 | Document ownership boundaries with orchestrator/tools/session/core.             |           |      |

### Implementation Phase 2

- GOAL-RUNTIME-002: Core runtime capability completion.

| Task             | Description                                                                     | Completed | Date |
| ---------------- | ------------------------------------------------------------------------------- | --------- | ---- |
| TASK-RUNTIME-004 | Complete turn execution loop for model deltas, tool calls, and approval pauses. |           |      |
| TASK-RUNTIME-005 | Finalize hook registry and policy evaluation pathways.                          |           |      |
| TASK-RUNTIME-006 | Complete cache-aware context handling and token governance integration.         |           |      |

### Implementation Phase 3

- GOAL-RUNTIME-003: Cross-package integration.

| Task             | Description                                                                         | Completed | Date |
| ---------------- | ----------------------------------------------------------------------------------- | --------- | ---- |
| TASK-RUNTIME-007 | Integrate tools/guardrails/session/memory/retrieval orchestrations in runtime loop. |           |      |
| TASK-RUNTIME-008 | Add integration tests for approval, policy refusal, and resume/replay paths.        |           |      |
| TASK-RUNTIME-009 | Emit runtime lifecycle telemetry and ensure trace completeness.                     |           |      |

### Implementation Phase 4

- GOAL-RUNTIME-004: Hardening and release gates.

| Task             | Description                                                                  | Completed | Date |
| ---------------- | ---------------------------------------------------------------------------- | --------- | ---- |
| TASK-RUNTIME-010 | Add stress/failure-mode suites for streaming interruption and tool failures. |           |      |
| TASK-RUNTIME-011 | Update docs/examples for operator-safe runtime behavior.                     |           |      |
| TASK-RUNTIME-012 | Pass package and monorepo release gates.                                     |           |      |

## 3. Acceptance Criteria

- **ACC-RUNTIME-001**: Runtime execution and policy behavior are deterministic and test-validated.
- **ACC-RUNTIME-002**: Integration flows with tools/session/memory/orchestrator pass end-to-end tests.
- **ACC-RUNTIME-003**: Safety and release gates pass.

## 4. Sources Synthesized

- `plan/MASTER-IMPLEMENTATION-PLAN.md`
- `plan/feature-cli-dogfood-production-order-1.md`
- `docs/packages/runtime.md`
- `packages/runtime/README.md`
- `packages/runtime/IMPLEMENTATION-PLAN.md`

## 5. Existing Package Deep-Dive (Preserved)

---

## @agentsy/runtime — Implementation Plan

## Role in Framework Ecosystem

`@agentsy/runtime` is the **execution environment** of the framework. It provides the secure "container" where a single agent's reasoning loop resides. It manages the agent's state, enforces security policies, executes tool calls in a sandbox, and synchronizes state with UI surfaces via the AG-UI protocol.

It sits between `@agentsy/orchestrator` (which coordinates multiple runtimes) and `@agentsy/core` (which provides the stream processing primitives).

### Ecosystem Sketch

    [ @agentsy/orchestrator ]
             |
             v
    [ @agentsy/runtime ] <--- Agent Loop & Sandbox
             |
             +-----------------------+-----------------------+
             |                       |                       |
             v                       v                       v
     [ Hook Registry ]       [ Approval Engine ]     [ AG-UI Bridge ]
     (Lifecycle Events)      (HITL Gates)            (State Sync)
             |                       |                       |
             +-----------+-----------+-----------+-----------+
                         |
                         v
                 [ @agentsy/core ]

## Fulfillment of Role

The package fulfills its role by implementing a stateful agent loop with the following capabilities:

1. **AgentLoop Authority**: The primary loop that drives the `think -> act -> observe` cycle.
2. **Security Sandboxing**: Ensuring tool execution is restricted to safe boundaries.
3. **Approval Workflows**: Implementing Human-in-the-loop (HITL) gates for destructive actions.
4. **AG-UI Protocol**: A dedicated subpath (`@agentsy/runtime/ag-ui`) for real-time UI synchronization.
5. **Hook System**: Allowing extensions to tap into lifecycle events (e.g., `before_tool`, `after_turn`).

## Detailed Functionality

### 1. Agent Loop (`src/loop/`)

- **Mechanism**: `AgentLoop` interface with `executeStep` and `configure` methods.
- **Responsibility**: Orchestrating the calls to `@agentsy/core` and managing the message history.
- **Loop Logic**:
  - Select model and tools.
  - Call `@agentsy/core/universal-client`.
  - Process output events (text, tool calls).
  - Execute tools via the sandbox.
  - Check for `StopCondition` predicates (e.g., max turns reached).

### 2. Sandbox & Policy (`src/sandbox/`)

- **Responsibility**: Secure execution.
- **Mechanism**: `ExecutionPolicy` and `Sandbox` interfaces.
- **Functionality**:
  - **Pluggable Backends**: `local` (Node `vm`), `docker`, `e2b`, `modal`, `wasm`.
  - **Allow/Deny Lists**: Restricting which tools an agent can use.
  - **Resource Limits**: Enforcing timeouts and memory caps on tool calls.
  - **Path Confinement**: Restricting file-system tools to the project root; `../` sequences rejected (SEC-002).
  - **Tool Validation**: Native argument validation.
  - **MCP Filtering**: Filtering server connections by trust level (trusted/untrusted/readonly) (SEC-007).
  - **SSRF Prevention**: Validating destination URLs against an egress allowlist (SEC-008).

### 3. Approval Engine (`src/approval/`)

- **Mechanism**: `ApprovalRequest` and `recordDecision` flow.
- **Deferred Execution**: Support for tool calls that are deferred for human input.
- **Enforcement**: All destructive tool calls (file overwrite, shell exec, network egress) MUST pass through approval engine (SEC-001).
- **Modes**:
  - `allow`: Execute without asking.
  - `ask`: Pause and wait for human confirmation.
  - `deny`: Block execution automatically.
  - `auto`: Automatic approval based on trust-tier or previously approved patterns.
  - `plan`: Dry-run mode for previewing tool effects.

### 4. AG-UI Bridge (`src/ag-ui/`)

- **Responsibility**: Real-time state synchronization.
- **Protocol**: Emits events for step start, tool selection, thought block updates, and incremental text deltas, allowing UIs to show exactly what the agent is "thinking."

### 5. Durable execution and replay references

Runtime durability should be designed around checkpoint-and-replay semantics rather than ad hoc state mutation. The useful patterns to mirror are Chidori-style deterministic replay and Agentspan-style durable pause/resume.

- Persist enough loop state to resume after a crash without re-running side effects.
- Keep tool-call boundaries explicit so a failed turn can be replayed or resumed from the last safe checkpoint.
- Treat the runtime instance as the owner of its state, which keeps the implementation actor-like without turning the package into a general-purpose workflow engine.
- If the host application adopts cryptographic approval receipts, expose a compatibility layer rather than baking trust proof mechanics directly into the core loop.

## Logic & Data Flow

### 1. The Execution Turn

1. `AgentLoop.executeStep()` is triggered.
2. `HookRegistry.trigger('before_step')` runs.
3. Runtime assembles the current context (History + Memory).
4. Request is sent to `@agentsy/core`.
5. As chunks arrive, `AG-UI Bridge` emits synchronization events.
6. If a tool call is detected:
   - `ApprovalEngine.requiresApproval()` is checked.
   - If approved, `Sandbox.execute()` runs the tool.
7. Results are appended to history, and `HookRegistry.trigger('after_step')` runs.

## Key Interfaces

### AgentLoop

    export interface AgentLoop {
      execute(task: string): Promise<RunResult>;
      executeStep(): Promise<StepResult>;
      getState(): AgentLoopState;
      pause(): Promise<void>;
      resume(): Promise<void>;
    }

### RuntimeContext

    export interface RuntimeContext {
      agentId: AgentId;
      sessionId: SessionId;
      config: AgentConfig;
      sandbox: Sandbox;
      hooks: HookRegistry;
      policy: ExecutionPolicy;
    }

### AgentExecutor (LobeHub pattern)

    export interface AgentExecutor {
      execute(agent: Agent, input: AgentInput): Promise<AgentOutput>;
      stream(agent: Agent, input: AgentInput): AsyncIterator<AgentChunk>;
    }

### Signal System

- **Responsibility**: Inter-agent communication.
- **Mechanism**: `AgentSignal` package concern (LobeHub pattern).
- **Functionality**: Dedicated communication layer for coordinating multiple runtimes.

## Implementation Details

### Boundary Enforcement

Strictly prevent cross-imports between `@agentsy/runtime` and `@agentsy/orchestrator`. The runtime should be oblivious to the fact that it might be part of a larger workflow; it only knows its current agent configuration and session state.

### Integration with Core

The runtime consumes `@agentsy/core/processor` and `@agentsy/core/universal-client` as its primary dependencies for interacting with LLMs.

### External patterns to preserve

- **Bernstein-style determinism**: scheduling and coordination decisions should be reproducible, not hidden inside model calls.
- **Rivet-style ownership**: each runtime instance should own a clear state boundary and communicate through explicit events.
- **Yao-style hooks**: lifecycle hooks should be able to intercept requests, approvals, and policy decisions without breaking the main loop.
- **AG-UI compatibility**: runtime event emission should remain transport-agnostic so UI surfaces can subscribe without knowing the execution backend.

## Sources Synthesized

`agentsy-agents-v1.md`, `agentsy-tech.md`, `agentsy-testing-plan.md`, `RECONCILIATION-REPORT.md`, `DECISION-LOG.md`, `research/AGENT-PLATFORMS-ANALYSIS.md`, `packages/runtime/IMPLEMENTATION-PLAN.md`.

---

## Agentsy Runner: Model Search & Fetch Support (NEW)

The Agentsy runner must support **model discovery and acquisition** for local execution from:

- Hugging Face
- Ollama
- other open provider registries (via adapter interface)

### Ownership split

- `@agentsy/models`: recommendation + ranking + fetch plan generation
- `@agentsy/providers`: source adapters and protocol adapters
- `@agentsy/runtime` (runner): executes search/fetch/install flows and model activation lifecycle

### Runner acquisition workflow

1. Runner receives user criteria (task, budget, local preference, hardware constraints).
2. Runner calls `@agentsy/models` recommendation service.
3. Runner receives ranked models + `ModelArtifactFetchPlan` entries.
4. Runner executes plan through `@agentsy/providers` source adapters.
5. Runner validates checksum/license/compatibility.
6. Runner registers local model and optionally warm-loads provider runtime.

### Runtime interfaces (planned)

    interface RunnerModelService {
      search(criteria: RecommendationCriteria): Promise<ModelRecommendation[]>;
      fetch(plan: ModelArtifactFetchPlan): Promise<LocalModelRecord>;
      install(localModelId: string): Promise<void>;
      listInstalled(): Promise<LocalModelRecord[]>;
    }

### Local provider execution support

For `agentsy-local-llama` execution, runner lifecycle must include:

- model preflight checks (GGUF, quantization, context)
- resource fit checks (RAM/VRAM/Metal/CUDA capability)
- optional source conversion path support (e.g., Ollama split blobs -> GGUF)
- warm pool policy and unload policy hooks

### Local automodel selection with llama-swap (NEW)

When the recommendation layer returns multiple viable local candidates, runtime should be able to launch a llama-swap-backed endpoint instead of binding directly to a single backend.

This is the preferred strategy when:

- multiple models need to share one OpenAI-compatible endpoint,
- hot-swapping between backends is desirable,
- the selected model can be served by multiple local runtimes with different tradeoffs,
- the user wants one stable endpoint while the runtime manages backend churn.

Runtime responsibilities:

1. Translate recommendation plans into llama-swap model entries.
2. Start or reuse the llama-swap process with the generated config file.
3. Route requests to the hot-swapped endpoint and monitor `/running`, `/logs`, and `/health`.
4. Fall back to direct provider execution if llama-swap is unavailable.
5. Preserve streamed responses by disabling reverse-proxy buffering where applicable.

Suggested runtime state model:

    interface LocalAutomodelSession {
      selectedModelId: string;
      selectedRuntime: 'llama-swap' | 'ollama' | 'llama.cpp' | 'vllm' | 'mlx' | 'apfel';
      endpointUrl: string;
      configPath?: string;
      runningModels: string[];
    }

### Quality gates for runner acquisition path

1. deterministic dry-run mode for fetch plans
2. resumable downloads and retry policy
3. integrity + provenance capture for each installed model
4. explicit approval gate for large downloads or external network egress

### Quality gates for local automodel selection

1. same input recommendation must yield the same ranked local plan
2. llama-swap config rendering must be deterministic and idempotent
3. if llama-swap is unavailable, runtime must continue with direct backend execution
4. streamed requests must not regress behind reverse proxies

// Main runtime manager
export class RuntimeManager {
constructor(config: RuntimeConfig);

// Agent loop management (merged from agentic-loop)
createLoop(config: LoopConfig): Promise<AgentLoop>;
getLoop(loopId: string): Promise<AgentLoop | null>;

// Execution lifecycle
executeOperation(operation: Operation, context: RuntimeContext): Promise<ExecutionResult>;

// Policy enforcement
evaluatePolicies(operation: Operation, context: RuntimeContext): Promise<PolicyResult[]>;
enforcePolicies(results: PolicyResult[]): Promise<void>;

// Monitoring
getMetrics(): RuntimeMetrics;
getDiagnostics(): RuntimeDiagnostics;
healthCheck(): Promise<HealthStatus>;
}

    ### Integration Strategy

    #### Merge agentic-loop INTO runtime

    - All agentic-loop functionality becomes part of runtime package
    - AgentLoop class becomes core runtime component
    - Loop execution integrates with sandbox and policies
    - Runtime becomes the definitive execution engine

    #### Key Integration Points

    1. **Loop Execution**: AgentLoop uses RuntimeContext and Sandbox
    2. **Tool Execution**: Tools execute within runtime sandbox
    3. **Policy Enforcement**: Policies checked during loop execution
    4. **Hook System**: Hooks triggered at loop lifecycle events
    5. **Approval Workflows**: Required operations go through approval

    #### Migration Benefits

    - Single, comprehensive runtime package
    - Clear separation of concerns within runtime
    - Integrated loop and execution concerns
    - Simplified package dependencies

    ### Implementation Features

    #### Agent Loop Integration

    - Loop orchestration within runtime context
    - State management integrated with runtime monitoring
    - Hook system integration for loop lifecycle
    - Policy enforcement during loop execution

    #### Sandboxing

    - Resource limits (CPU, memory, network)
    - File system access controls
    - Network request filtering
    - Time execution limits
    - Process isolation where possible

    #### Approval Workflows

    - Configurable approval requirements
    - Multi-step approval chains
    - Role-based approval delegation
    - Timeout and escalation handling
    - Approval audit trail

    #### Hook System

    - Pre/post loop execution hooks
    - Error handling hooks
    - Approval hooks
    - Monitoring hooks
    - Custom hook registration

    ### Dependencies (merged from agentic-loop)

    - Internal: `@agentsy/types` - Core interfaces
    - Internal: `@agentsy/tools` - Tool execution
    - Internal: `@agentsy/guardrails` - Safety policies
    - Internal: `@agentsy/session` - Loop state persistence
    - External: Sandbox libraries
    - External: Monitoring and telemetry

    ### Test Strategy

    - Loop execution scenarios
    - Sandbox isolation and security tests
    - Approval workflow scenarios
    - Policy enforcement validation
    - Integration with all dependent packages

    ### Co-development Dependencies

    - `tools` - Tool execution integration
    - `guardrails` - Safety policy integration
    - `session` - Loop state persistence
    - `processor` - Stream processing integration

    ### Implementation Milestones

    #### Phase 1: Runtime Core + Loop Foundation

    - [ ] RuntimeManager base implementation
    - [ ] AgentLoop class (merged from agentic-loop)
    - [ ] RuntimeContext interface
    - [ ] Basic sandbox implementation
    - [ ] HookRegistry foundation

    #### Phase 2: Loop Integration

    - [ ] AgentLoop integration with RuntimeManager
    - [ ] Loop execution within runtime context
    - [ ] State management integration
    - [ ] Loop lifecycle hooks
    - [ ] Policy enforcement during loop execution

    #### Phase 3: Security & Sandboxing

    - [ ] Resource limit enforcement
    - [ ] File system controls
    - [ ] Network filtering
    - [ ] Time limit enforcement
    - [ ] Security validation

    #### Phase 4: Approval & Policy Systems

    - [ ] ApprovalWorkflow implementation
    - [ ] Policy engine integration
    - [ ] Hook system completion
    - [ ] Approval integration with loop execution
    - [ ] Policy enforcement optimization

    #### Phase 5: Advanced Features

    - [ ] Performance optimizations
    - [ ] Advanced monitoring
    - [ ] Diagnostic tools
    - [ ] Loop performance tuning
    - [ ] Configuration management

    ### Migration from agentic-loop

    #### Step 1: Prepare runtime package

    - Add agentic-loop interfaces to runtime types
    - Prepare AgenticLoop integration
    - Import necessary dependencies from agentic-loop

    #### Step 2: Move agentic-loop code

    - Move AgenticLoop class to runtime/agentic-loop/
    - Move loop configuration to runtime/config/
    - Move loop state management to runtime/state/
    - Move loop utilities to runtime/utils/

    #### Step 3: Integrate and enhance

    - Integrate AgenticLoop with RuntimeManager
    - Add sandbox and policy integration
    - Connect hooks and approval systems
    - Update all integration points

    #### Step 4: Cleanup

    - Delete agentic-loop package
    - Update all imports across packages
    - Update documentation
    - Run integration tests

    ### File Structure (final runtime package)

    ```text
    packages/runtime/src/
    ├── index.ts                    # Public exports
    ├── core/
    │   ├── manager.ts             # RuntimeManager (main entry point)
    │   ├── context.ts             # RuntimeContext
    │   └── config.ts              # Runtime configuration
    ├── loop/                       # Merged from agentic-loop
    │   ├── agent-loop.ts          # AgentLoop main class
    │   ├── state.ts               # Loop state management
    │   ├── execution.ts           # Loop execution logic
    │   └── lifecycle.ts           # Loop lifecycle management
    ├── sandbox/
    │   ├── sandbox.ts             # Sandbox implementation
    │   ├── isolation.ts           # Process isolation
    │   ├── limits.ts              # Resource limits
    │   └── validation.ts          # Security validation
    ├── approval/
    │   ├── workflow.ts            # ApprovalWorkflow
    │   ├── steps.ts               # Approval steps
    │   └── delegation.ts           # Role-based delegation
    ├── hooks/
    │   ├── registry.ts            # HookRegistry
    │   ├── events.ts              # Lifecycle events
    │   └── handlers.ts            # Hook handlers
    ├── policies/
    │   ├── engine.ts              # Policy engine
    │   ├── enforcement.ts         # Policy enforcement
    │   └── evaluation.ts          # Policy evaluation
    ├── security/
    │   ├── permissions.ts         # Permission management
    │   ├── validation.ts          # Security validation
    │   └── audit.ts               # Security audit
    └── monitoring/
        ├── metrics.ts             # Runtime metrics
        ├── diagnostics.ts         # Diagnostic tools
        └── health.ts              # Health monitoring

### Verification Criteria

- [ ] All agentic-loop functionality works in runtime
- [ ] Loop execution integrates with sandbox and policies
- [ ] Hook system triggers at correct loop points
- [ ] Approval workflows work with loop operations
- [ ] Performance overhead is acceptable
- [ ] Integration with all dependent packages works

### Risk Register

- **Medium**: Complex integration between loop and runtime concerns
- **Medium**: Migration complexity from agentic-loop
- **Low**: Performance overhead from added runtime features
- **Low**: Hook execution order and timing issues

---

## Token Optimization & Efficiency Patterns (2026-05-14)

### CRITICAL: Virtual Sandbox Implementation

**Flue Virtual Sandbox Pattern Adoption**

- **Rationale:** Default to virtual sandbox (just-bash) for simple operations, containers only for coding/git/browser
- **Expected Benefits:** 10x faster startup, ~90% infrastructure cost reduction for simple tasks
- **Implementation Pattern:** Default to virtual, containers trigger only for coding/git/browser operations
- **ROI:** Dramatically faster, cheaper, more scalable for high-traffic agents

**Hybrid Sandbox Architecture:**

    // Hybrid virtual + container sandbox pattern
    interface HybridSandboxArchitecture {
      // Default: virtual sandbox for simple operations
      virtual: {
        default: 'true';
        operations: ['file', 'read', 'write', 'search', 'simple tasks'];
        performance: '10x faster startup';
        cost: '90% infrastructure savings';
        implementation: 'just-bash command execution';
      };

      // Container: full environments when needed
      container: {
        triggers: ['git', 'browser', 'full coding environments'];
        fallback: 'Virtual if container unavailable';
        performance: 'Full git/browsers/environments';
        cost: 'Higher but necessary for complex tasks';
      };

      // Trigger logic
      triggers: {
        git: 'Git operations need full git repository';
        browser: 'Browser automation needs headless browser';
        coding: 'Full coding environments need container isolation';
      };
    }

**Implementation Priorities:**

1. **Virtual Sandbox Default (Weeks 1-4):**
   - Implement just-bash virtual sandbox as default
   - Add container trigger logic for git/browser/coding
   - Test performance improvements and cost savings

2. **Container Detection Logic (Weeks 5-6):**
   - Automatic detection of when container needed
   - Fallback to virtual if container unavailable
   - Performance monitoring and optimization

3. **Startup Optimization (Weeks 7-8):**
   - 10x faster virtual sandbox startup
   - Lazy container initialization
   - Resource optimization strategies

### Task Delegation with Isolated History

**Flue Task Pattern Adoption**

- **Rationale:** Detached session spawning with isolated message history for parallel execution
- **Expected Benefits:** Parallel execution, clean semantics, no history pollution
- **Implementation Pattern:** Create detached sessions for delegated tasks, shared sandbox/filesystem
- **ROI:** Performance improvement, efficient parallelism

**Task Delegation Architecture:**

    // Task delegation with isolated history
    interface TaskDelegationArchitecture {
      // Create detached sessions for delegated tasks
      delegation: {
        createDetachedSession: 'Spawn isolated agent session';
        isolatedHistory: 'Separate message history for each task';
        sharedResources: 'Common sandbox and filesystem access';
      };

      // Clean separation semantics
      separation: {
        precedence: 'call > session > harness (Flue pattern)';
        isolation: 'No cross-task pollution';
        coordination: 'honker pub/sub for synchronization';
      };

      // Performance benefits
      performance: {
        parallel: 'True parallel execution without conflict';
        speed: '3x faster multi-agent workflows';
        reliability: 'Clean semantics prevent state conflicts';
      };
    }

**Implementation Priorities:**

1. **Detached Session Spawning (Weeks 9-10):**
   - Implement session spawning with isolated history
   - Add shared sandbox and filesystem management
   - Test parallel execution capabilities

2. **Precedence Rules (Weeks 11-12):**
   - Implement call > session > harness precedence
   - Add context isolation mechanisms
   - Test semantic clarity and separation

3. **Parallel Execution (Weeks 13-14):**
   - Enable true parallel task execution
   - Add coordination via honker pub/sub
   - Performance optimization and monitoring

### Runtime Coordination with Honker

**Cross-Process Runtime Integration**

- **Rationale:** honker pub/sub for runtime events and coordination across processes
- **Expected Benefits:** 1-5ms coordination latency vs polling, atomic queue operations
- **Integration Pattern:** honker for cross-process events and runtime coordination; any queue/scheduling primitives consumed here are orchestrator-owned workflows exposed through runtime-safe adapters
- **ROI:** 90% infrastructure savings vs custom broker, near-instant coordination

**Ownership clarification:**

- `@agentsy/runtime` does not own scheduler semantics, recurring job policy, or task-board state machines.
- `@agentsy/orchestrator` owns task semantics and may use honker/SQLite, PostgreSQL, plaintext/file, and cron-compatible drivers beneath its scheduler abstraction.
- `@agentsy/runtime` only participates as the execution environment for orchestrator-dispatched work and as the emitter/consumer of coordination events.

**Runtime Coordination Architecture:**

    // Runtime coordination via honker
    interface RuntimeCoordinationArchitecture {
      // honker pub/sub for cross-process events
      pubSub: {
        channels: ['agent-lifecycle', 'runtime-updates', 'coordination-events'];
        latency: '1-5ms vs current polling';
        reliability: 'Atomic commits prevent lost events';
      };

      // Integration with runtime
      integration: {
        lifecycle: 'Agent startup/shutdown events via pub/sub';
        updates: 'Real-time runtime state synchronization';
        workflows: 'Execution support for orchestrator-managed background workflows';
      };
    }

**Implementation Priorities:**

1. **Pub/Sub Integration (Weeks 15-16):**
   - honker pub/sub for agent lifecycle events
   - Real-time runtime state synchronization
   - Cross-process coordination

2. **Workflow Coordination Integration (Weeks 17-18):** runtime adapters for orchestrator-backed queue/scheduling workflows, job cancellation and heartbeat support at the execution boundary, and state synchronization for active background work.

3. **Atomic Workflow Patterns (Weeks 19-20):**
   - Atomic commits with runtime operations
   - Rollback safety for failed workflows
   - Reliability and performance optimization

### Role-Based Orchestration

**Flue Role Pattern Adoption**

- **Rationale:** Call-scoped system prompt overlays with clean precedence
- **Expected Benefits:** Cleaner context, no history pollution, better agent coordination
- **Implementation Pattern:** Role system with precedence rules, call-scoped overlays
- **ROI:** Architectural improvement, better agent coordination

**Role Orchestration Architecture:**

    // Role-based orchestration with precedence
    interface RoleOrchestrationArchitecture {
      // Role system with precedence
      roles: {
        precedence: 'call > session > harness (Flue pattern)';
        callScoped: 'System prompt overrides for specific calls';
        overlays: 'Context without polluting base system prompt';
      };

      // Clean separation semantics
      separation: {
        context: 'No history pollution across role changes';
        coordination: 'Clear agent context boundaries';
        flexibility: 'Dynamic role switching without state conflicts';
      };

      // Coordination benefits
      benefits: {
        coordination: 'Better multi-agent workflow management';
        clarity: 'Clean semantical role boundaries';
        performance: 'Faster context management';
      };
    }

**Implementation Priorities:**

1. **Role System Foundation (Weeks 21-22):**
   - Implement precedence rules (call > session > harness)
   - Add call-scoped system prompt overlays
   - Test context separation

2. **Dynamic Role Switching (Weeks 23-24):**
   - Enable dynamic role changes without state conflicts
   - Add context management for role transitions
   - Test flexibility and reliability

### Combined Expected Benefits

**Cost Efficiency:**

- **Infrastructure:** 90% cost reduction for simple tasks with virtual sandbox
- **Coordination:** 90% infrastructure savings via honker vs custom broker
- **Parallelism:** 3x faster multi-agent workflows with task delegation

**Performance:**

- **Startup:** 10x faster virtual sandbox startup vs containers
- **Coordination:** 1-5ms runtime events vs current polling
- **Speed:** 3x faster parallel execution with isolated history

**Developer Experience:**

- **Simplicity:** Cleaner semantics with role-based orchestration
- **Flexibility:** Dynamic role switching without state conflicts
- **Reliability:** Atomic workflow patterns prevent lost operations

**Agent Capabilities:**

- **Scale:** 10x more agents with same infrastructure budget (virtual sandbox)
- **Parallelism:** True parallel execution without context conflicts
- **Coordination:** Near-instant cross-process runtime events

### Integration Timeline Summary

**Phase 0: Token Optimization Foundation (Weeks 1-8)**

- Virtual sandbox implementation ( Weeks 1-4)
- Container detection logic (Weeks 5-6)
- Startup optimization (Weeks 7-8)

**Phase 1: Task Delegation (Weeks 9-14)**

- Detached session spawning (Weeks 9-10)
- Precedence rules (Weeks 11-12)
- Parallel execution (Weeks 13-14)

**Phase 2: Runtime Coordination (Weeks 15-20)**

- Pub/Sub integration (Weeks 15-16)
- Task queue integration (Weeks 17-18)
- Atomic workflow patterns (Weeks 19-20)

**Phase 3: Role Orchestration (Weeks 21-24)**

- Role system foundation (Weeks 21-22)
- Dynamic role switching (Weeks 23-24)

---

## Alignment Snapshot (migrated from `plan/alignment-report-5-11-26.md`)

- Runtime ownership boundary is confirmed complete: session-backed snapshots, spawned child execution, and workflow ordering live in `@agentsy/runtime`.
- Runtime/docs consistency status: aligned with `MASTER-IMPLEMENTATION-PLAN`, `DECISION-LOG`, and `PACKAGE-NAMING-MAP`.
- Verification signal in source report: all major gates were green when snapshot was taken (build/check-types/test).

---

## Extracted Technical API Surface (from `plan/agentsy-tech.md`)

### Approval + sandbox contracts

    type ApprovalMode = 'allow' | 'ask' | 'deny' | 'auto' | 'plan';
    type SandboxMode = 'read-only' | 'process' | 'full-access';

    interface ApprovalEngine {
      evaluate(call: ToolCall): Promise<ApprovalResult>;
    }

    interface ToolExecutor {
      executeAll(calls: ToolCall[], options: { signal: AbortSignal; sessionId?: string }): Promise<ToolResult[]>;
    }

### Runtime obligations carried forward

- Pre-tool-use hooks execute before rule evaluation.
- Rule evaluation order remains deny/allow/ask with explicit specificity behavior preserved by shared policy semantics.
- Tool repair hook (`repairToolCall`) remains optional executor extension.
- Skill/plugin loading remains checksum-verified where remote manifests are permitted.

### AG-UI alignment

- Runtime remains the canonical home for AG-UI protocol support via `@agentsy/runtime/ag-ui`.
- Standalone `@agentsy/ag-ui` package references in `agentsy-tech.md` are treated as historical and mapped to runtime subpath exports.
