# IMPLEMENTATION-PLAN.md

## Package: @agentsy/universal-client

### Overview
Universal AI client abstraction layer providing a consistent interface across OpenAI, Anthropic, and other LLM providers. Shield agents from provider-specific API changes while enabling intelligent request routing, model selection, and automatic failover.

### Current Status
➕️ To be created - This is a new package concept not yet implemented

### Core Responsibilities
- Provider-agnostic API interface
- Intelligent request routing and retry logic
- Model selection based on requirements
- Automatic failover and backup providers
- Token counting and budget awareness
- Response normalization and standardization
- Performance optimization and caching

### Public API Design
```typescript
// Universal client interface
export interface UniversalClient {
  // Core operations
  complete(request: CompletionRequest): Promise<CompletionResponse>
  stream(request: StreamingRequest): AsyncIterable<StreamChunk>
  embed(request: EmbeddingRequest): Promise<EmbeddingResponse>
  chat(request: ChatRequest): Promise<ChatResponse>
  
  // Model management
  listModels(): Promise<Model[]>
  getModel(modelId: string): Promise<Model | null>
  
  // Provider management
  getProvider(): Provider
  switchProvider(providerId: string, config?: ProviderConfig): Promise<UniversalClient>
  
  // Error handling
  handleError(error: Error, context?: RequestContext): Promise<ErrorResult>
  
  // Metrics and monitoring
  getMetrics(): Promise<ClientMetrics>
  
  // Configuration
  updateConfig(config: Partial<ClientConfig>): void
  getConfig(): ClientConfig
}

// Universal request interfaces
export interface CompletionRequest {
  prompt: string
  model?: string
  temperature?: number
  maxTokens?: number
  tools?: ToolCall[]
  metadata?: Record<string, unknown>
}

export interface StreamingRequest {
  prompt: string
  model?: string
  temperature?: number
  maxTokens?: number
  tools?: ToolCall[]
  tools_choice?: 'auto' | 'required' | 'optional'
  stream?: boolean
  metadata?: Record<string, unknown>
}

// Universal response normalization
export interface NormalizedResponse {
  provider: string
  model: string
  content: string
  usage: TokenUsage
  finishReason?: string
  metadata?: Record<string, unknown>
  confidence: number
}

// Client factory
export class UniversalClientFactory {
  createClient(providerId: string, config?: ClientConfig): Promise<UniversalClient>
  createMultiProviderClient(configs: ProviderConfig[]): Promise<MultiProviderClient>
  createOpportunisticClient(config?: ClientConfig): Promise<UniversalClient>
}

// Multi-provider client for redundancy and failover
export class MultiProviderClient implements UniversalClient {
  constructor(configs: ProviderConfig[])
  
  executeWithRouting(request: CompletionRequest): Promise<CompletionResult>
  executeWithFallback(request: CompletionRequest): Promise<CompletionResult>
  
  // Provider switching
  switchProvider(providerId: string): Promise<void>
  reportProviderHealth(providerId: string): Promise<ProviderHealth>
}

// Model selection service
export class ModelSelector {
  selectModel(criteria: ModelSelectionCriteria): Promise<ModelRecommendation>
  getModelCapabilities(modelId: string): Promise<ModelCapabilities>
  estimateTokenUsage(request: CompletionRequest): Promise<TokenUsage>
  optimizeModelPerformance(criteria: OptimizationCriteria): Promise<ModelOptimization>
}
```

### Implementation Strategy

#### Core Architecture
```
Provider-independent layer
├── Request routing (smart routing based on availability)
├── Response normalization (standardize from all providers)
├── Error handling (unified error patterns)
└── Performance optimization (caching, batching, compression)

Provider adapters
├── OpenAI adapter (gpt-4o, gpt-5+)  
├── Anthropic adapter (claude-3.5, claude-3.5-sonnet)
├── Gemini adapter (gemini-1.5, gemini-2.0-flash)
├── Ollama adapter (local models)
├── Custom adapter (swagger/other providers)

Smart routing
- Performance-based provider selection
- Cost-aware model selection
- Quality-adjusted routing (temp/quality tradeoffs)
- Health monitoring and failover
- Geographic region optimization
- Model capability matching
```

#### Model Selection Algorithm
```typescript
export interface ModelSelectionCriteria {
  requirements: Capability[]
  constraints: ModelConstraints
  performance: PerformanceRequirements
  costBudget: CostTarget
  latencyTarget?: LatencyTarget
  preferredProviders?: string[]
  avoidProviders?: string[]
}

interface ModelRecommendation extends ModelCapabilities {
  provider: string
  model: string
  score: number
  reasoning: string
  alternatives: ModelAlternative[]
  estimatedCost: number
  estimatedLatency: number
}
```

#### Error Recovery Strategies
```typescript
// Error categorization and recovery
const errorStrategies = {
  'rate_limit': Retry with exponential backoff
  'model_unavailable': Switch to alternative model
  'token_limit': Reduce complexity or switch model
  'network_error': Fall back to offline/default provider
  'api_key': Alert and request new key
  'parse_error': Try alternative parsing or fallback provider
}
```

### Dependencies
- Internal: `@agentsy/types` - Core interfaces
- Internal: `@agentsy/providers` - Provider configuration
- Internal: `@agentsy/tokens` - Budget integration
- External: Provider-specific SDKs (OpenAI, Anthropic, etc.)

### Test Strategy
- Cross-provider compatibility tests
- Error scenario simulation
- Performance benchmarks
- Fault tolerance validation
- Model selection accuracy tests

### Co-development Dependencies
- `providers` - Provider registry models and capabilities
- `tokens` - Budget integration and cost modeling
- `runtime` - Error handling integration
- `telemetry` - Performance monitoring

### Integration with Other Packages
- `providers` - Provider-specific client implementations
- `runtime` - As part of runtime consolidation
- `session` - Request context persistence
- `processor` - Stream processing integration

### Source Plan References
- `plan/agentsy-providers.md` - Comprehensive provider architecture
- `plan/agentsy-tech.md` §4.4 - Universal client design
- `plan/agentsy-token-economy.md` - Budget and cost management

### Implementation Milestones

#### Phase 1: Core Universal Interface
- [ ] UniversalClient interface definition
- [ ] Request/Response interfaces
- [ ] Error handling base classes
- [ ] Provider adapter interface
- [ ] Client factory implementation

#### Phase 2: OpenAI Provider Implementation
- [ ] OpenAI adapter implementation
- [ ] OpenAI client class
- [ ] Model selector integration
- [ ] Response normalization
- [ ] Error handling for OpenAI

#### Phase 3: Anthropic Provider Implementation
- [ ] Anthropic adapter implementation
- [ ] Claude client class
- - Tool calling integration
- [ ] Streaming support for Claude
- [ ] Error handling for Anthropic

#### Phase 4: Multi-Provider Support
- [ ] Additional providers (Gemini, etc.)
- [ ] Multi-provider client class
- [ ] Provider health monitoring
- [ ] Smart routing implementation
- [ ] Failover mechanisms

#### Phase 5: Advanced Features
- [ ] Model selection algorithms
- [ ] Performance optimization
- [ ] Quality-based routing
- [ ] Cost optimization
- [ ] Analytics and monitoring

### File Structure
```
packages/universal-client/src/
├── index.ts                    # Public exports
├── core/
│   ├── client.ts              # UniversalClient interface
│   ├── request.ts             # Request interfaces
│   ├── response.ts           # Response interfaces
│   ├── error.ts               # Error handling
│   └── factory.ts             # ClientFactory
├── adapters/
│   ├── base.ts               # Base adapter interface
│   ├── openai.ts              # OpenAI adapter
│   ├── anthropic.ts           # Anthropic adapter
│   ├── gemini.ts             # Gemini adapter
│   ├── ollama.ts             # Ollama adapter
│   ├── custom/               # Custom adapter templates
│   └── registry.ts           # Provider registry
├── selection/
│   ├── selector.ts            # ModelSelector
│   ├── ranking.ts              # Model ranking algorithms
│   └── optimizer.ts           # Performance optimization
├�── routing/
│   ├── router.ts              # Smart routing logic
│   ├── failover.ts            # Failover handling
│   └── health.ts              # Provider health monitoring
├── utils/
│   ├── tokenizer.ts            # Token counting
│   ├── normalizer.ts         # Response normalization
│   ├── metrics.ts             # Performance metrics
│   └── cache.ts              # Caching strategies
└── monitoring/
│   ├── collector.ts           # Metrics collection
│   ├── analyzer.ts           # Performance analysis
│   └── reporter.ts            # Report generation
└�── config/
│   ├── provider-config.ts       # Provider configuration
│   └── client-config.ts       # Client configuration
│   └── validation.ts        # Validation rules
│   └── limits.ts             // Rate limit enforcement
└── expectations.json      # Client expectations
└── benchmark.ts           # Performance benchmarks
```

### Phase 5: Code-Generation Integration
```typescript
// Enhanced code generation with SQLite-backed prompts
interface CodeGenerationEngine {
  // Vector-based prompt matching (inspired by sqlite-ollama-rag)
  promptLibrary: {
    sqliteDatabase: string
    vectorTable: 'prompt_embeddings'
    codeExamples: 'code_snippets'
    patterns: 'coding_patterns'
  }
  
  // Context-aware generation
  contextGeneration: {
    includeProjectStructure: boolean
    includeImports: boolean
    includeSimilarCode: boolean
    includeConventions: boolean
  }
}
```

### Verification Criteria
- [ ] All supported providers work through universal interface
- [ ] Smart routing works under failure scenarios
- [ ] Model selection returns optimal recommendations
- [ ] Error recovery is robust and automated
- [ ] Performance overhead is minimal (<5% overhead)
- [ ] Cost optimizations are effective
- [ ] Integration with dependent packages works
- [ ] Vector-based prompt matching improves code generation
- [ ] Context-aware generation produces better results

### Risk Register
- **High**: Provider API changes requiring adapter updates
- **Medium**: Complex provider-specific edge cases
- **Low**: Performance overhead from abstraction layer
- **Low**: Configuration management complexity
- **Low**: Model selection algorithm accuracy

### Migration Notes
- When adding a new provider, only the adapter needs implementation
- Existing clients remain compatible
- Provider configuration updates without client changes
- Smart routing adapts automatically to new providers