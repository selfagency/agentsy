# IMPLEMENTATION-PLAN.md

## Package: @agentsy/runtime

### Overview
Agent runtime execution engine providing sandboxing, approval workflows, hook execution, and tool execution policies. Manages the secure execution environment for agentic loops with fine-grained control and monitoring.

### Note
This package will be **merged into agentic-loop** as per the architecture decision - runtime concerns belong in the loop engine itself. This plan describes the functionality to be integrated.

### Core Responsibilities
- Secure execution sandboxing
- Approval workflow management
- Hook system for lifecycle events
- Tool execution policies and permissions
- Runtime monitoring and diagnostics

### Public API Design
```typescript
// To be integrated into agentic-loop package

// Runtime execution context
export interface RuntimeContext {
  sessionId: string
  agentId: string
  permissions: PermissionSet
  policies: ExecutionPolicy[]
  hooks: HookRegistry
  sandbox: SandboxConfig
  telemetry: TelemetryConfig
}

// Execution sandbox
export interface Sandbox {
  execute(request: ExecutionRequest): Promise<ExecutionResult>
  validate(request: ExecutionRequest): Promise<ValidationResult>
  cleanup(): Promise<void>
  
  // Resource management
  setLimit(resource: string, limit: ResourceLimit): void
  getUsage(resource: string): ResourceUsage
  resetUsage(): void
}

// Approval workflow
export interface ApprovalWorkflow {
  requiresApproval(operation: Operation): boolean
  requestApproval(request: ApprovalRequest): Promise<ApprovalDecision>
  recordDecision(decision: ApprovalDecision): Promise<void>
  
  // Workflow configuration
  addStep(step: ApprovalStep): void
  removeStep(stepId: string): void
  configureConditions(conditions: ApprovalCondition[]): void
}

// Hook system
export interface HookRegistry {
  registerHook(event: LifecycleEvent, hook: Hook): string
  unregisterHook(hookId: string): void
  triggerHooks(event: LifecycleEvent, context: HookContext): Promise<HookResult[]>
  
  // Hook management
  listHooks(event?: LifecycleEvent): Hook[]
  getHook(hookId: string): Hook | null
}

// Execution policies
export interface ExecutionPolicy {
  id: string
  name: string
  conditions: PolicyCondition[]
  actions: PolicyAction[]
  priority: number
  enabled: boolean
}

// Runtime manager (to be integrated into AgentLoop)
export class RuntimeManager {
  constructor(config: RuntimeConfig)
  
  // Execution lifecycle
  executeOperation(operation: Operation, context: RuntimeContext): Promise<ExecutionResult>
  
  // Policy enforcement
  evaluatePolicies(operation: Operation, context: RuntimeContext): Promise<PolicyResult[]>
  enforcePolicies(results: PolicyResult[]): Promise<void>
  
  // Monitoring
  getMetrics(): RuntimeMetrics
  getDiagnostics(): RuntimeDiagnostics
  healthCheck(): Promise<HealthStatus>
}
```

### Integration Strategy

#### Merge into agentic-loop
- All runtime functionality becomes part of AgentLoop class
- Runtime context becomes loop execution context
- Sandbox management integrated into loop execution
- Approval workflows become loop-level controls

#### Core Integration Points
1. **Loop Execution**: Each loop iteration creates runtime context
2. **Tool Execution**: Tools execute within runtime sandbox
3. **Policy Enforcement**: Policies checked before each operation
4. **Hook System**: Hooks triggered at loop lifecycle events
5. **Approval Workflows**: Required operations go through approval

#### Migration Benefits
- Simplified architecture with fewer packages
- Direct integration between loop and runtime concerns
- Reduced overhead from inter-package communication
- More cohesive execution model

### Implementation Features

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
- Pre/post execution hooks
- Error handling hooks
- Approval hooks
- Monitoring hooks
- Custom hook registration

#### Policy Engine
- Rule-based policy evaluation
- Priority-based policy ordering
- Context-aware policy application
- Policy testing and validation
- Dynamic policy updates

### Dependencies (to be merged into agentic-loop)
- Internal: `@agentsy/types` - Core interfaces
- Internal: `@agentsy/tools` - Tool execution
- Internal: `@agentsy/guardrails` - Safety policies
- External: Sandbox libraries
- External: Monitoring and telemetry

### Test Strategy
- Sandbox isolation and security tests
- Approval workflow scenarios
- Policy enforcement validation
- Hook execution order tests
- Performance under policy overhead

### Co-development Dependencies
- `agentic-loop` - Target merge destination
- `tools` - Tool execution integration
- `guardrails` - Safety policy integration
- `session` - Runtime context persistence

### Source Plan References
- `plan/agentsy-runtime.md` - Complete runtime architecture
- `plan/agentsy-tech.md` §4.5 - Execution sandboxing
- `plan/agentsy-agents-v1.md` §5.2 - Approval workflows

### Implementation Milestones (as part of agentic-loop)

#### Phase 1: Runtime Core
- [ ] RuntimeContext interface
- [ ] Basic Sandbox implementation
- [ ] HookRegistry foundation
- [ ] Simple ApprovalWorkflow
- [ ] Integration into AgentLoop

#### Phase 2: Security & Sandboxing
- [ ] Resource limit enforcement
- [ ] File system controls
- [ ] Network filtering
- [ ] Time limit enforcement
- [ ] Security validation

#### Phase 3: Approval System
- [ ] Multi-step workflows
- [ ] Role-based delegation
- [ ] Escalation handling
- [ ] Audit trail implementation
- [ ] Workflow testing

#### Phase 4: Policy Engine
- [ ] Policy rule evaluation
- [ ] Priority-based ordering
- [ ] Context-aware application
- [ ] Dynamic policy updates
- [ ] Policy testing framework

#### Phase 5: Advanced Features
- [ ] Performance optimizations
- [ ] Advanced monitoring
- [ ] Diagnostic tools
- [ ] Configuration management
- [ ] Migration utilities

### Migration Path to agentic-loop

#### Step 1: Prepare agentic-loop
- Add runtime-related interfaces to agentic-loop types
- Create RuntimeManager as part of AgentLoop class
- Import necessary dependencies

#### Step 2: Move Core Components
- Move Sandbox implementation into agentic-loop
- Move HookRegistry into agentic-loop
- Move ApprovalWorkflow into agentic-loop
- Move ExecutionPolicy into agentic-loop

#### Step 3: Update Integration Points
- Update agentic-loop to use runtime context
- Integrate sandbox into loop execution
- Add policy enforcement to loop operations
- Connect approval workflows to loop decisions

#### Step 4: Cleanup
- Delete runtime package
- Update all imports across packages
- Update documentation
- Run integration tests

### File Structure (target in agentic-loop)
```
packages/agentic-loop/src/
├── index.ts                    # Public exports
├── loop/
│   ├── agent-loop.ts          # Main AgentLoop class (enhanced)
│   └── execution.ts           # Loop execution logic
├── runtime/                    # Merged from runtime package
│   ├── context.ts             # RuntimeContext
│   ├── sandbox.ts             # Sandbox implementation
│   ├── hooks.ts               # HookRegistry
│   ├── approval.ts            # ApprovalWorkflow
│   ├── policies.ts            # ExecutionPolicy
│   └── manager.ts             # RuntimeManager (integrated)
├── security/
│   ├── permissions.ts         # Permission management
│   ├── isolation.ts           # Process isolation
│   └── validation.ts          # Security validation
└── monitoring/
    ├── metrics.ts             # Runtime metrics
    ├── diagnostics.ts         # Diagnostic tools
    └── health.ts              # Health monitoring
```

### Verification Criteria (after merge)
- [ ] All runtime features work within agentic-loop
- [ ] Sandbox isolation is effective
- [ ] Approval workflows integrate seamlessly
- [ ] Hook system triggers at correct points
- [ ] Policy enforcement is consistent
- [ ] Performance overhead is acceptable

### Risk Register
- **Medium**: Complex integration between loop and runtime concerns
- **Medium**: Sandbox implementation complexity
- **Low**: Performance overhead from policy enforcement
- **Low**: Hook execution order and timing issues