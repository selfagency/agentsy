# IMPLEMENTATION-PLAN.md

## Package: @agentsy/types

### Overview
Foundation package providing shared TypeScript types for the entire @agentsy/* ecosystem. This is the base dependency that all other packages build upon.

### Current Status
✅ **Live** - Published package with stable API surface

### Public API
```typescript
// Core stream types
export interface StreamEvent { /* ... */ }
export interface StreamChunk { /* ... */ }
export interface StreamState { /* ... */ }

// Provider types  
export interface Provider { /* ... */ }
export interface Model { /* ... */ }
export interface TokenBudget { /* ... */ }

// Agent types
export interface AgentConfig { /* ... */ }
export interface AgentMessage { /* ... */ }
export interface AgentTool { /* ... */ }

// Memory types
export interface MemoryEntry { /* ... */ }
export interface RetrievalQuery { /* ... */ }
export interface VectorEmbedding { /* ... */ }

// Common utility types
export type LiteralUnion = T extends string ? T | (string & {}) : never;
```

### Migration Boundary
- **Stable**: Core stream types (`StreamEvent`, `StreamChunk`, `StreamState`)
- **Stable**: Provider interfaces (`Provider`, `Model`, `TokenBudget`) 
- **Stable**: Agent message types (`AgentMessage`, `AgentTool`)
- **Evolving**: Memory types may expand as retrieval system matures
- **Internal**: Test utility types may change without major version bumps

### Dependencies
- External: `type-fest` for utility types
- Internal: None (foundation package)

### Test Strategy
- Type-level testing with TypeScript compiler
- Runtime type guards where applicable
- Cross-package compatibility tests via `integration` package

### Co-development Dependencies
This package co-develops with:
- `processor` - Stream processing types
- `providers` - Provider interface contracts
- `memory` - Memory and retrieval types
- `agentic-loop` - Agent orchestration types

### Dependencies on This Package
All other packages depend on types. Critical path:
1. `xml-filter` - Needs `StreamEvent`
2. `context` - Needs `StreamState` 
3. `tool-calls` - Needs `AgentTool`
4. `providers` - Needs `Provider`, `Model`, `TokenBudget`

### What is Intentionally Not Included
- Runtime implementations (pure types only)
- Provider-specific types (those belong in provider packages)
- UI component types (those belong in `ui` package)
- Test-specific types (use `vitest` types instead)

### Source Plan References
- `plan/agentsy-tech.md` §2.1 - Type system foundation
- `plan/agentsy-memory.md` §3 - Memory type definitions
- `plan/agentsy-providers.md` §4 - Provider interface contracts

### Implementation Milestones

#### Current (v0.1.1)
- ✅ Core stream types published
- ✅ Provider interface contracts
- ✅ Agent message and tool types
- ✅ Memory and retrieval type foundations

#### Next (v0.2.0)
- 🔄 Add structured output types for newer models
- 🔄 Expand retrieval types for vector search
- 🔄 Add session persistence types
- 🔄 Improve token budgeting type contracts

#### Future (v0.3.0)
- 📋 Add plugin/skill interface types
- 📋 Add ACP protocol types
- 📋 Add connector protocol types
- 📋 Add telemetry event types

### Verification Criteria
- [ ] TypeScript compilation passes across all dependent packages
- [ ] No circular type dependencies
- [ ] Published types match implementation types
- [ ] Type coverage > 95% for exported APIs

### Migration Notes
This package follows semantic versioning carefully since it's a foundation dependency:
- **Major versions**: Breaking changes to exported types
- **Minor versions**: New additive types only
- **Patch versions**: Bug fixes, documentation, internal cleanup

### Risk Register
- **High**: Breaking changes cascade to all dependent packages
- **Medium**: Type version drift with implementation packages
- **Low**: External dependency updates (type-fest)