---
goal: @agentsy/prompts production implementation plan
version: 1.0
date_created: 2026-05-15
last_updated: 2026-05-25
owner: prompts-maintainers
status: In progress
tags: [feature, architecture, prompts, policy, composition]
---

# Introduction

![Status: In progress](https://img.shields.io/badge/status-In%20progress-yellow)

This plan defines the production implementation order for `@agentsy/prompts` as the deterministic prompt policy and composition stack.

## 1. Requirements & Constraints

- **REQ-PROMPTS-001**: Prompt composition supports layered precedence (system, workspace, session, slash overrides).
- **REQ-PROMPTS-002**: Prompt transforms are deterministic and reproducible.
- **REQ-PROMPTS-003**: Budget-aware truncation/compression integrates with token governance.
- **REQ-PROMPTS-004**: Prompt provenance and assembly diagnostics are explainable.
- **SEC-PROMPTS-001**: Untrusted inserted content is sanitized before inclusion.
- **SEC-PROMPTS-002**: Policy-critical directives remain immutable without explicit override authorization.
- **CON-PROMPTS-001**: Provider transport concerns remain outside prompts package.
- **CON-PROMPTS-002**: Memory retrieval ranking logic remains in memory/retrieval packages.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-PROMPTS-001: Contract and precedence stabilization.

| Task             | Description                                                         | Completed | Date |
| ---------------- | ------------------------------------------------------------------- | --------- | ---- |
| TASK-PROMPTS-001 | Stabilize prompt layer schema and precedence rules.                 |           |      |
| TASK-PROMPTS-002 | Add typed tests for deterministic assembly and policy immutability. |           |      |
| TASK-PROMPTS-003 | Document boundary ownership with runtime/tokens/memory.             |           |      |

### Implementation Phase 2

- GOAL-PROMPTS-002: Core prompt stack implementation.

| Task             | Description                                                         | Completed | Date |
| ---------------- | ------------------------------------------------------------------- | --------- | ---- |
| TASK-PROMPTS-004 | Implement composable prompt graph and deterministic merge pipeline. |           |      |
| TASK-PROMPTS-005 | Implement budget-aware compression/truncation adapters.             |           |      |
| TASK-PROMPTS-006 | Implement provenance diagnostics and explainability payloads.       |           |      |

### Implementation Phase 3

- GOAL-PROMPTS-003: Integration and operator pathways.

| Task             | Description                                                               | Completed | Date |
| ---------------- | ------------------------------------------------------------------------- | --------- | ---- |
| TASK-PROMPTS-007 | Integrate runtime request path and slash command prompt controls.         |           |      |
| TASK-PROMPTS-008 | Add integration tests for policy stack behavior under budget pressure.    |           |      |
| TASK-PROMPTS-009 | Validate compatibility with memory injection and retrieval context flows. |           |      |

### Implementation Phase 4

- GOAL-PROMPTS-004: Hardening and release gates.

| Task             | Description                                                                                                                                    | Completed | Date |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-PROMPTS-010 | Add regression suites for composition determinism and safety filters.                                                                          |           |      |
| TASK-PROMPTS-011 | Update docs/examples for prompt policy operation.                                                                                              |           |      |
| TASK-PROMPTS-012 | Pass package and monorepo release gates.                                                                                                       |           |      |
| TASK-064         | DOGFOOD Phase 4: Integrate prompt policy stack for deterministic prompt assembly and token-aware truncation/compression before provider calls. |           |      |

### Implementation Phase 4.5 — Instructions and Skills layer segments

- GOAL-PROMPTS-004.5: Add InstructionsLayer, SkillsLayer, and InstructionsComposer segment types for the skills/instructions/agent system.

| Task             | Description                                                                                                                                                                      | Completed | Date |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-PROMPTS-013 | Define `InstructionsLayer` segment type — position (prefix/suffix/beforeTools), priority, source provenance, content, metadata (origin root, file name, agent scope).            |           |      |
| TASK-PROMPTS-014 | Define `SkillsLayer` segment type — skill ID, semver, activation match data, content, trigger, resource references.                                                              |           |      |
| TASK-PROMPTS-015 | Implement `InstructionsComposer` in `src/layers/` — merges InstructionsLayer segments into prompt stack in priority order, deduplicates by content hash, respects budget limits. |           |      |
| TASK-PROMPTS-016 | Wire `InstructionsComposer` with existing `SegmentComposer` pipeline — inserts instructions before tool definitions, ensures skills segments inject before user messages.        |           |      |
| TASK-PROMPTS-017 | Add unit tests: layer segment merging, priority ordering, deduplication, budget trimming, source provenance tracking.                                                            |           |      |

## 3. Acceptance Criteria

- **ACC-PROMPTS-001**: Prompt assembly is deterministic and test-validated.
- **ACC-PROMPTS-002**: Runtime integration and budget behavior are verified.
- **ACC-PROMPTS-003**: Release gates pass.

## 4. Sources Synthesized

- `plan/MASTER-IMPLEMENTATION-PLAN.md`
- `plan/feature-cli-dogfood-production-order-1.md`
- `docs/packages/prompts.md`
- `packages/prompts/README.md`
- `packages/prompts/IMPLEMENTATION-PLAN.md`

## 5. Existing Package Deep-Dive (Preserved)

---

## @agentsy/prompts Implementation Plan

## Overview

Create a prompt optimization and agentic pattern management module that integrates with tokens and memory packages for budget-aware, persistent prompt handling.

## Scope

### Core Features

1. **Prompt Optimization**
   - Classical techniques (few-shot, chain-of-thought, self-consistency)
   - Modern techniques (instruction tuning, structured prompting)
   - Agentic-specific patterns (ReAct, task decomposition, reasoning loops)

2. **Token Integration**
   - Prompt compression and token budget awareness
   - Breaking prompts into smaller modular units
   - Context window management and truncation strategies

3. **Memory Integration**
   - Global system prompts storage and retrieval
   - Session-level prompt management
   - Prompt versioning and history tracking

4. **Project-Specific Instructions**
   Workspace instruction ingestion from repository-local instruction files, layered merge of user defaults/project instructions/session overrides, and structured projection of the active instruction stack for CLI diagnostics.

### Priority Areas

1. **Agent System Prompts** - System-level guidance and behavior shaping
2. **Reasoning Patterns** - Framework for agentic thinking and decision-making
3. **Safety/Guardrails** - Structured safety measures and content filtering

## Module Structure

```text
packages/prompts/
├── src/
│   ├── optimization/
│   │   ├── PromptOptimizer.ts          # Main optimization interface
│   │   ├── compression/
│   │   │   └── TextCompressor.ts       # Text compression strategies
│   │   ├── chunking/
│   │   │   └── PromptChunker.ts        # Breaking prompts into units
│   │   └── strategies/
│   │       ├── FewShotStrategy.ts
│   │       ├── ChainOfThoughtStrategy.ts
│   │       └── StructuredPrompting.ts
│   ├── patterns/
│   │   ├── AgenticPatterns.ts           # ReAct, task decomposition
│   │   ├── ReasoningFramework.ts       # Agentic thinking framework
│   │   └── SystemPromptTemplates.ts    # Pre-built system prompts
│   ├── safety/
│   │   ├── GuardrailManager.ts         # Safety measure management
│   │   ├── ContentFilters.ts           # Content filtering rules
│   │   └── SafetyStrategies.ts         # Safety enforcement
│   ├── memory/
│   │   ├── PromptStorage.ts            # Memory integration for prompts
│   │   ├── GlobalPrompts.ts            # Global system prompts
│   │   ├── SessionPrompts.ts           # Session-level prompts
│   │   └── PromptHistory.ts            # Version history tracking
│   └── types/
│       ├── optimization.ts
│       ├── patterns.ts
│       └── safety.ts
├── tests/
│   ├── optimization/
│   ├── patterns/
│   ├── safety/
│   └── memory/
└── package.json
```

## Integration Points

### With @agentsy/tokens

```typescript
// Token budget aware optimization
import { TokenBudget, TokenCounter } from "@agentsy/tokens";

interface OptimizedPrompt {
  chunks: PromptChunk[];
  estimatedTokens: number;
  budgetCompliant: boolean;
  compressionRatio: number;
}

class PromptOptimizer {
  constructor(
    private tokenCounter: TokenCounter,
    private budget: TokenBudget,
  ) {}

  optimize(prompt: string, constraints: OptimizationConstraints): OptimizedPrompt {
    // Use token counting and budgeting for optimization
  }
}
```

### With @agentsy/memory

```typescript
// Persistent prompt storage and retrieval
import { MemoryStore, MemoryRetrieval } from "@agentsy/memory";

class PromptStorage {
  constructor(
    private memoryStore: MemoryStore,
    private retrieval: MemoryRetrieval,
  ) {}

  async storeSystemPrompt(prompt: SystemPrompt): Promise<void> {
    // Store in memory with versioning
  }

  async getSessionPrompts(sessionId: string): Promise<Prompt[]> {
    // Retrieve session-specific prompts from memory
  }
}
```

### With project/workspace instructions

The prompts package must support a deterministic instruction stack assembled from:

1. built-in/default system prompts
2. user-level preferences from `~/.agentsy/agentsy.yml`
3. project-level instructions (`.agents/AGENTS.md`, `.github/copilot-instructions.md`, repo-local instruction/skill assets)
4. session-level overrides
5. inline slash-command overrides

The package should expose a merged prompt artifact plus provenance metadata so the CLI can show which project-specific instructions are active.

## Implementation Tasks

### Phase 1: Foundation (1-2 days)

- [ ] Create package structure and dependencies
- [ ] Define core types and interfaces
- [ ] Set up memory integration infrastructure
- [ ] Implement basic PromptStorage
- [ ] Add tests for memory integration

### Phase 2: Core Optimization (2-3 days)

- [ ] Implement PromptOptimizer interface
- [ ] Add token budget awareness
- [ ] Implement text compression strategies
- [ ] Create prompt chunking logic
- [ ] Add token estimation and budget compliance checking
- [ ] Write comprehensive tests for optimization

### Phase 3: Agentic Patterns (2-3 days)

- [ ] Implement ReAct pattern
- [ ] Create task decomposition framework
- [ ] Add chain-of-thought reasoning
- [ ] Implement structured prompting
- [ ] Create system prompt templates library
- [ ] Add tests for agentic patterns

### Phase 3.5: Project Instruction Layering

- [ ] Implement project instruction ingestion contracts
- [ ] Add precedence resolution logic for user/project/session overrides
- [ ] Add provenance metadata for active instruction sources
- [ ] Add tests for deterministic instruction-stack merging

### Phase 4: Safety & Guardrails (1-2 days)

- [ ] Implement GuardrailManager
- [ ] Create content filtering rules
- [ ] Add safety strategies and enforcement
- [ ] Integrate safety with optimization pipeline
- [ ] Add safety tests

### Phase 5: Integration & Testing (2-3 days)

- [ ] Integrate tokens package for budget management
- [ ] Integrate memory package for prompt persistence
- [ ] Create end-to-end optimization workflows
- [ ] Add comprehensive integration tests
- [ ] Performance testing and optimization

### Phase 6: Documentation (1 day)

- [ ] Write API documentation
- [ ] Create usage examples
- [ ] Document integration patterns
- [ ] Add migration guide for existing systems

## Dependencies

- `@agentsy/tokens` - Token counting and budget management
- `@agentsy/memory` - Prompt storage and persistence
- `@agentsy/core` - Stream processing and structured outputs

## Success Criteria

- [ ] Optimizes prompts while maintaining quality
- [ ] Reduces token usage by 20-40% on average
- [ ] Successfully manages prompts within token budget constraints
- [ ] Persists and retrieves prompts reliably via memory integration
- [ ] Provides agentic-specific patterns (ReAct, task decomposition)
- [ ] Includes comprehensive safety and guardrail measures
- [ ] Full test coverage (>90%)
- [ ] Performance impact <10% on prompt generation

## Risks & Mitigations

- **Risk**: Over-aggressive optimization degrades prompt quality
  - **Mitigation**: Quality metrics and fallback strategies
- **Risk**: Memory integration adds latency
  - **Mitigation**: Caching strategies and async optimization
- **Risk**: Token estimation inaccuracies
  - **Mitigation**: Multiple estimation methods and validation
- **Risk**: Safety measures restrict legitimate prompts
  - **Mitigation**: Configurable safety levels and whitelist capabilities

## Next Steps

1. Review this plan with stakeholders
2. Iterate on module structure and interfaces
3. Begin Phase 1 implementation
4. Regular sync on progress and trade-offs
