# IMPLEMENTATION-PLAN.md

## Package: @agentsy/runtime

### Overview

Runtime execution engine providing sandboxing, approval workflows, hook execution, agent loop orchestration, and tool execution policies. Manages the secure execution environment for agents with fine-grained control and monitoring.

### Note

**AGENTIC-LOOP WILL BE MERGED INTO RUNTIME** - this runtime package becomes the primary execution engine. The agentic-loop package will be deleted and its functionality moved here, since "runtime" better describes the comprehensive execution engine we're building.

### Core Responsibilities

- Agent loop orchestration and execution
- Secure execution sandboxing
- Approval workflow management
- Hook system for lifecycle events
- Tool execution policies and permissions
- Runtime monitoring and diagnostics

### Public API Design

```typescript
// Runtime execution context
export interface RuntimeContext {
  sessionId: string;
  agentId: string;
  loopId: string;
  permissions: PermissionSet;
  policies: ExecutionPolicy[];
  hooks: HookRegistry;
  sandbox: SandboxConfig;
  telemetry: TelemetryConfig;
}

// Agent loop (merged from agentic-loop)
export interface AgentLoop {
  id: string;
  config: LoopConfig;

  // Core loop execution
  execute(): Promise<LoopResult>;
  executeStep(): Promise<StepResult>;

  // State management
  getState(): LoopState;
  configure(config: LoopConfig): void;

  // Lifecycle
  start(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  stop(): Promise<void>;
}

// Execution sandbox
export interface Sandbox {
  execute(request: ExecutionRequest): Promise<ExecutionResult>;
  validate(request: ExecutionRequest): Promise<ValidationResult>;
  cleanup(): Promise<void>;

  // Resource management
  setLimit(resource: string, limit: ResourceLimit): void;
  getUsage(resource: string): ResourceUsage;
  resetUsage(): void;
}

// Approval workflow
export interface ApprovalWorkflow {
  requiresApproval(operation: Operation): boolean;
  requestApproval(request: ApprovalRequest): Promise<ApprovalDecision>;
  recordDecision(decision: ApprovalDecision): Promise<void>;

  // Workflow configuration
  addStep(step: ApprovalStep): void;
  removeStep(stepId: string): void;
  configureConditions(conditions: ApprovalCondition[]): void;
}

// Hook system
export interface HookRegistry {
  registerHook(event: LifecycleEvent, hook: Hook): string;
  unregisterHook(hookId: string): void;
  triggerHooks(event: LifecycleEvent, context: HookContext): Promise<HookResult[]>;

  // Hook management
  listHooks(event?: LifecycleEvent): Hook[];
  getHook(hookId: string): Hook | null;
}

// Execution policies
export interface ExecutionPolicy {
  id: string;
  name: string;
  conditions: PolicyCondition[];
  actions: PolicyAction[];
  priority: number;
  enabled: boolean;
}

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
```

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
```

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
