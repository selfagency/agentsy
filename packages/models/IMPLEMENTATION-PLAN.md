# @agentsy/models — Implementation Plan

## Purpose

model selection engine with intelligent provider/model matching, cost estimation, and capability analysis. Integrate with models.dev API to provide access to 100+ providers with complete capability/cost data, enabling cost-optimized, capability-aware model selection while maintaining Agentsy's differentiated orchestration.

## Architecture

Models package capabilities conform to the model selection and orchestration layer in the framework ecosystem. Agents integrate via `@agentsy/orchestrator` for intelligent model selection and cost estimation.

```text
model selection engine → @agentsy/orchestrator → provider/model selection → cost-optimized execution
```

## Current Source Layout

```text
packages/models/src/
  index.ts                    # Public exports
  types.ts                    # Type definitions
  model-selector.test.ts      # Unit tests
```

## Ecosystem Integration Analysis (2026-05-14)

### CRITICAL: models.dev API Integration

**Primary Integration Strategy**

- **Rationale:** Comprehensive open-source database with 100+ providers and complete model specifications
- **Expected Benefits:** Cost-optimized model selection, automatic provider updates, capability-aware matching
- **Implementation:** Cache models.dev API (24-hour TTL with fallback) for provider/model discovery
- **ROI:** 3-6 months of manual model management, continuous updates, cost optimization

**models.dev Capabilities:**

```typescript
// models.dev integration architecture
interface ModelsDevIntegration {
  // API capabilities
  api: {
    providers: '100+ providers vs 11 hardcoded';
    specifications: 'Complete model specs (capabilities, limits, pricing)';
    discovery: 'Provider discovery and configuration automation';
  };

  // Cost estimation
  cost: {
    estimation: 'Per task/model with input/output, caching costs';
    optimization: 'Cost-aware model selection and orchestration';
    accuracy: '±10% accuracy on cost predictions';
  };

  // Capability matching
  capabilities: {
    matching: 'tool_call, reasoning, attachment, temperature';
    requirements: 'Task requirement analysis and model compatibility';
  };

  // Integration strategy
  integration: {
    cache: '24-hour TTL with fallback to live API';
    selection: 'Intelligent model selection engine';
    orchestration: 'Cost-aware agent and model ranking';
  };
}
```

## Core Design Contracts

### Model Selection Engine

```ts
interface ModelSelector {
  selectModel(requirements: TaskRequirements, availableModels: ModelInfo[]): Promise<ModelSelection>;
  estimateCost(model: ModelInfo, inputTokens: number, outputTokens: number): Promise<CostEstimate>;
  discoverProviders(): Promise<ProviderInfo[]>;
  getModelInfo(modelId: string): Promise<ModelInfo>;
}
```

### Model Selection Request

```ts
interface TaskRequirements {
  modality: 'text' | 'image' | 'audio' | 'code' | 'multimodal';
  capabilities: string[]; // e.g., 'tool_call', 'reasoning', 'attachment'
  specialization?: string; // e.g., 'coding', 'creative', 'analysis'
  budget?: number; // Max cost for this task
  quality?: 'fast' | 'balanced' | 'premium';
  constraints?: ModelConstraints;
}
```

### Model Selection Response

```ts
interface ModelSelection {
  model: ModelInfo;
  provider: ProviderInfo;
  confidence: number; // 0-1 score for match quality
  estimatedCost: CostEstimate;
  alternatives?: ModelSelection[]; // Backup options
}
```

### Cost Estimation Coverage

```ts
interface CostEstimate {
  inputCost: number; // per 1M tokens
  outputCost: number; // per 1M tokens
  cacheCost?: number; // per 1M cache read/write tokens
  totalCost: number; // Estimated for this task
  confidence: number; // 0-1 score for accuracy
}
```

## Implementation Status

| Feature            | Status                    |
| ------------------ | ------------------------- |
| `types`            | ✅ Basic type definitions |
| `model-selector`   | ❌ Not started            |
| `api` integration  | ❌ Not started            |
| `cache`            | ❌ Not started            |
| `selection` engine | ❌ Not started            |
| `cost` estimation  | ❌ Not started            |
| `cli` commands     | ❌ Not started            |

## Dependencies

- `@agentsy/types` — Model-related types
- External: models.dev API integration
- Optional: caching layer for API responses

## Core Features

### 1. Model Selection Engine (`src/model-selector/`)

**Capability Analysis**

- Analyze task requirements (modality, capabilities, specialization, budget, quality)
- Match requirements against available models
- Score models for compatibility and quality
- Provide confidence scores and alternatives

**Cost-Aware Selection**

- Pre-execution cost estimation based on models.dev pricing data
- Budget verification before model selection
- Cost-aware agent and model ranking
- Priority-based model selection under budget constraints

**Pattern:**

```ts
modelSelector.selectModel(requirements, availableModels) -> { model, cost, confidence, alternatives }
```

### 2. Provider Discovery (`src/provider-discovery/`)

**API Integration**

- Fetch models.dev API for provider and model metadata
- Cache responses with 24-hour TTL
- Fallback to live API if cache expired or unavailable
- Update provider configurations automatically

**Provider Management**

- 100+ provider support (anthropic, openai, deepseek, etc.)
- Provider discovery and configuration automation
- Model logos and documentation links
- Capability matching by provider

### 3. Cost Estimation (`src/cost-estimator/`)

**Detailed Cost Calculation**

- Input/output token pricing per model
- Cache read/write costs where applicable
- Context window overflow handling
- Usage-based cost projections

**Accuracy Metrics**

- ±10% accuracy on cost predictions
- Confidence scores for estimations
- Historical cost tracking and learning

### 4. CLI Commands (`src/cli/`)

**Model Discovery**

- Search models by capabilities, providers, cost
- Compare model specifications side-by-side
- Test cost estimation for specific tasks

**Cost Analysis**

- Estimate costs for specific workflows
- Compare provider costs for similar models
- Optimize model selection for budget constraints

## Testing

```ts
// packages/models/src/model-selector/model-selector.test.ts
// packages/models/src/provider-discovery/discovery.test.ts
// packages/models/src/cost-estimator/estimation.test.ts
```

- Unit: capability matching, cost calculation, provider discovery
- Integration: models.dev API integration, cache logic
- Accuracy: cost estimation ±10% accuracy validation
- Performance: cache hit rates, API response times

## Export Surface

```ts
// packages/models/src/index.ts
export * from './model-selector/index.js';
export * from './provider-discovery/index.js';
export * from './cost-estimator/index.js';
export * from './cli/index.js'; // optional CLI commands
```

## Integration with Orchestrator

**Pattern:**

```ts
// Integration with @agentsy/orchestrator
// Model selection before execution
const selection = await modelSelector.selectModel(taskRequirements, availableModels);

// Cost-aware orchestration
 orchestrator.orchestrateTask(task, skills, budget) -> { agent, model, plan, estimatedCost }

// Budget verification
if (selection.estimatedCost.totalCost > budget) {
  // Fall back to cheaper alternatives
}
```

## Implementation Priorities

**Phase 1: API Integration & Caching (Weeks 1-4)**

- models.dev API client implementation
- 24-hour TTL caching with fallback
- Provider discovery and configuration
- Model metadata fetching

**Phase 2: Selection Engine (Weeks 5-10)**

- Task requirements analysis
- Capability matching algorithm
- Model scoring and ranking
- Confidence calculation and alternatives

**Phase 3: Cost Estimation (Weeks 11-14)**

- Detailed cost calculation engine
- Input/output/token pricing integration
- Budget constraint handling
- Cost projection and optimization

**Phase 4: CLI & Analytics (Weeks 15-16)**

- Model discovery commands
- Cost comparison tools
- Budget optimization suggestions
- Usage analytics

## Expected Benefits

**Cost Optimization:**

- **Model selection:** Intelligent model choice based on capabilities and pricing
- **Budget enforcement:** Cost-aware model selection and orchestration
- **Optimization:** 20-30% cost reduction through intelligent selection

**Capability Enhancement:**

- **Provider coverage:** 100+ providers vs 11 hardcoded models
- **Automatic updates:** Continuous provider and model updates without manual intervention
- **Matching accuracy:** Capability-aware model selection for better task performance

**Developer Experience:**

- **Discovery:** Easy model discovery and comparison
- **Testing:** Cost estimation for task scenarios before implementation
- **Configuration:** Automated provider configuration

**Strategic Positioning:**

By integrating models.dev, Agentsy gains:

1. **Model Selection Leadership:** Intelligent, cost-optimized model selection
2. **Provider Coverage:** 100+ provider access with automatic updates
3. **Cost Optimization:** Real-time cost estimation and budget management
4. **Capability Matching:** Task-aware model selection for better performance

This positions Agentsy as a **cost-optimized agent platform** with superior model selection and orchestration capabilities, differentiated by intelligent cost-aware model choice and comprehensive provider coverage.

## Risk Mitigation

**API Dependency:**

- **Risk:** models.dev API availability or changes
- **Mitigation:** 24-hour caching with fallback, graceful degradation

**Accuracy:**

- **Risk:** Cost estimation accuracy ±10% may not meet needs
- **Mitigation:** Historical learning and continuous improvement

**Complexity:**

- **Risk:** 100+ provider integration complexity
- **Mitigation:** Standardized API patterns, automated testing

## Success Metrics

**Cost Metrics:**

- **Optimization:** 20-30% cost reduction through intelligent selection
- **Accuracy:** ±10% cost estimation accuracy
- **Budget compliance:** 95% budget adherence rate

**Performance Metrics:**

- **Selection speed:** <100ms average model selection time
- **Cache hit rate:** >80% cache hit rate for频繁 accessed models
- **API fallback:** <5% API failure rate with graceful degradation

**Adoption Metrics:**

- **Provider coverage:** 90%+ common providers supported
- **Model discovery:** 80%+ users using CLI for model discovery
- **Cost analysis:** 70%+ workflows using cost estimation before execution

## Integration Timeline

**Week 1-2:** API client and caching infrastructure
**Week 3-4:** Provider discovery and model metadata
**Week 5-8:** Selection engine and capability matching
**Week 9-14:** Cost estimation and budget enforcement
**Week 15-16:** CLI commands and analytics

Total estimated effort: 14-16 weeks for full integration
