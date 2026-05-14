# @agentsy/runtime — Implementation Plan

## Role in Framework Ecosystem

`@agentsy/runtime` is the **execution environment** of the framework. It provides the secure "container" where a single agent's reasoning loop resides. It manages the agent's state, enforces security policies, executes tool calls in a sandbox, and synchronizes state with UI surfaces via the AG-UI protocol.

It sits between `@agentsy/orchestrator` (which coordinates multiple runtimes) and `@agentsy/core` (which provides the stream processing primitives).

### Ecosystem Sketch

```text
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
```

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

```typescript
export interface AgentLoop {
  execute(task: string): Promise<RunResult>;
  executeStep(): Promise<StepResult>;
  getState(): AgentLoopState;
  pause(): Promise<void>;
  resume(): Promise<void>;
}
```

### RuntimeContext

```typescript
export interface RuntimeContext {
  agentId: AgentId;
  sessionId: SessionId;
  config: AgentConfig;
  sandbox: Sandbox;
  hooks: HookRegistry;
  policy: ExecutionPolicy;
}
```

### AgentExecutor (LobeHub pattern)

```typescript
export interface AgentExecutor {
  execute(agent: Agent, input: AgentInput): Promise<AgentOutput>;
  stream(agent: Agent, input: AgentInput): AsyncIterator<AgentChunk>;
}
```

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

````text

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
````

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

## Alignment Snapshot (migrated from `plan/alignment-report-5-11-26.md`)

- Runtime ownership boundary is confirmed complete: session-backed snapshots, spawned child execution, and workflow ordering live in `@agentsy/runtime`.
- Runtime/docs consistency status: aligned with `MASTER-IMPLEMENTATION-PLAN`, `DECISION-LOG`, and `PACKAGE-NAMING-MAP`.
- Verification signal in source report: all major gates were green when snapshot was taken (build/check-types/test).

---

## Extracted Technical API Surface (from `plan/agentsy-tech.md`)

### Approval + sandbox contracts

```typescript
type ApprovalMode = 'allow' | 'ask' | 'deny' | 'auto' | 'plan';
type SandboxMode = 'read-only' | 'process' | 'full-access';

interface ApprovalEngine {
  evaluate(call: ToolCall): Promise<ApprovalResult>;
}

interface ToolExecutor {
  executeAll(calls: ToolCall[], options: { signal: AbortSignal; sessionId?: string }): Promise<ToolResult[]>;
}
```

### Runtime obligations carried forward

- Pre-tool-use hooks execute before rule evaluation.
- Rule evaluation order remains deny/allow/ask with explicit specificity behavior preserved by shared policy semantics.
- Tool repair hook (`repairToolCall`) remains optional executor extension.
- Skill/plugin loading remains checksum-verified where remote manifests are permitted.

### AG-UI alignment

- Runtime remains the canonical home for AG-UI protocol support via `@agentsy/runtime/ag-ui`.
- Standalone `@agentsy/ag-ui` package references in `agentsy-tech.md` are treated as historical and mapped to runtime subpath exports.
