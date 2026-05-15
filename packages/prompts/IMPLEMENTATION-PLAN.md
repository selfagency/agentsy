# @agentsy/prompts Implementation Plan

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
import { TokenBudget, TokenCounter } from '@agentsy/tokens';

interface OptimizedPrompt {
  chunks: PromptChunk[];
  estimatedTokens: number;
  budgetCompliant: boolean;
  compressionRatio: number;
}

class PromptOptimizer {
  constructor(
    private tokenCounter: TokenCounter,
    private budget: TokenBudget
  ) {}

  optimize(prompt: string, constraints: OptimizationConstraints): OptimizedPrompt {
    // Use token counting and budgeting for optimization
  }
}
```

### With @agentsy/memory

```typescript
// Persistent prompt storage and retrieval
import { MemoryStore, MemoryRetrieval } from '@agentsy/memory';

class PromptStorage {
  constructor(
    private memoryStore: MemoryStore,
    private retrieval: MemoryRetrieval
  ) {}

  async storeSystemPrompt(prompt: SystemPrompt): Promise<void> {
    // Store in memory with versioning
  }

  async getSessionPrompts(sessionId: string): Promise<Prompt[]> {
    // Retrieve session-specific prompts from memory
  }
}
```

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
