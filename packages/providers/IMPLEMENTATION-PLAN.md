# IMPLEMENTATION-PLAN.md

## Package: @agentsy/providers

### Overview

Universal AI provider management system supporting OpenAI, Anthropic, and other LLM providers. Handles provider registration, model selection, token budgeting, provider-specific adapters, parsers, and optimizations. ALL provider-specific logic lives here.

### Current Status

🔄 **Consolidation Target** - Package exists but needs to absorb normalizers and adapters

### Core Responsibilities

- Provider registration and management
- Universal AI client interface
- Model selection and routing
- Provider-specific token budgeting
- Provider capability detection

### Public API Design

```typescript
// Provider definition
export interface Provider {
  id: string;
  name: string;
  type: 'openai' | 'anthropic' | 'custom';
  capabilities: ProviderCapabilities;
  models: Model[];
  authentication: AuthenticationConfig;
  endpoints: Record<string, string>;
  metadata: Record<string, unknown>;
}

// Provider capabilities
export interface ProviderCapabilities {
  supportsStreaming: boolean;
  supportsFunctionCalling: boolean;
  supportsMultimodal: boolean;
  maxTokenLimit: number;
  supportedFormats: string[];
  rateLimits: RateLimit[];
}

// Model definition
export interface Model {
  id: string;
  providerId: string;
  name: string;
  type: 'completion' | 'chat' | 'embedding' | 'fine-tuning';
  capabilities: ModelCapabilities;
  pricing: ModelPricing;
  parameters: ModelParameterSchema;
}

// Universal client interface
export interface UniversalClient {
  // Core operations
  complete(request: CompletionRequest): Promise<CompletionResponse>;
  stream(request: StreamingRequest): AsyncIterable<StreamChunk>;
  embed(request: EmbeddingRequest): Promise<EmbeddingResponse>;

  // Function calling
  callTools(request: ToolCallRequest): Promise<ToolCallResponse>;

  // Model management
  listModels(): Promise<Model[]>;
  getModel(modelId: string): Promise<Model | null>;

  // Provider info
  getProvider(): Provider;
  checkCapabilities(request: Request): Promise<boolean>;
}

// Provider manager
export class ProviderManager {
  constructor(options?: ProviderManagerOptions);

  // Provider lifecycle
  registerProvider(provider: Provider): Promise<void>;
  unregisterProvider(providerId: string): Promise<void>;
  getProvider(providerId: string): Promise<Provider | null>;
  listProviders(filter?: ProviderFilter): Promise<Provider[]>;

  // Client creation
  createClient(providerId: string, config?: ClientConfig): Promise<UniversalClient>;

  // Model selection
  selectModel(criteria: ModelSelectionCriteria): Promise<ModelRecommendation>;

  // Provider routing
  routeRequest(request: Request): Promise<RoutingDecision>;
}

// Provider-specific client adapters
export interface ProviderAdapter {
  createClient(config: ClientConfig): Promise<UniversalClient>;
  normalizeRequest(request: UniversalRequest): ProviderRequest;
  normalizeResponse(response: ProviderResponse): UniversalResponse;
  calculateTokens(request: ProviderRequest, response: ProviderResponse): TokenUsage;
}
```

### Implementation Strategy

#### Provider Architecture

- **Core Interface**: Universal client abstracting provider differences
- **Adapter Pattern**: Provider-specific implementations
- **Plugin System**: Easy addition of new providers
- **Capability Detection**: Runtime capability introspection

#### Model Selection

- Filter-based model selection (capabilities, cost, performance)
- Multi-provider routing for cost optimization
- Dynamic model switching based on requirements
- Model performance tracking and learning

#### Token Budgeting Integration

- Provider-specific token counting
- Cost calculation per model
- Budget-aware request routing
- Usage tracking and reporting

#### Provider Subdirectories - Complete Provider Ecosystem

- `providers/openai/` - OpenAI adapter, parser, client, models, normalizers
- `providers/anthropic/` - Anthropic adapter, parser, client, models, normalizers
- `providers/custom/` - Template for custom providers
- **All provider logic together**: adapters, parsers, normalizers, clients, models
- `adapters` package will be DELETED - adapters moved into respective provider directories

### Dependencies

- Internal: `@agentsy/types` - Core interfaces
- Internal: `@agentsy/secrets` - Credential management
- Internal: `@agentsy/tokens` - Budget integration
- External: Provider-specific SDKs and APIs

### Test Strategy

- Provider adapter contract tests
- Model selection algorithm validation
- Token counting accuracy tests
- Performance benchmarks
- Error handling scenarios

### Co-development Dependencies

- `secrets` - Credential management
- `tokens` - Budget integration
- `tool-calls` - Function calling support
- `runtime` - Client lifecycle management

### Source Plan References

- `plan/agentsy-providers.md` - Complete provider architecture
- `plan/agentsy-tech.md` §4.1 - Universal client design
- `plan/agentsy-token-economy.md` - Provider cost integration

### Implementation Milestones

#### Phase 1: Provider Foundation

- [ ] Provider interfaces and types
- [ ] ProviderManager core implementation
- [ ] UniversalClient interface
- [ ] Provider registration and lifecycle
- [ ] Basic provider listing and discovery

#### Phase 2: OpenAI Provider

- [ ] OpenAI provider implementation
- [ ] OpenAI adapter and client
- [ ] Chat completion adapter
- [ ] Streaming support
- [ ] Function calling adapter

#### Phase 3: Anthropic Provider

- [ ] Anthropic provider implementation
- [ ] Claude adapter and client
- [ ] Message API adapter
- [ ] Streaming support
- [ ] Tool use adapter

#### Phase 4: Model Selection & Routing

- [ ] Model selection algorithms
- [ ] Multi-provider routing
- [ ] Cost-based optimization
- [ ] Capability-based filtering
- [ ] Performance tracking

#### Phase 5: Consolidation & Advanced

- [ ] Absorb normalizers package
- [ ] Absorb adapters package
- [ ] Custom provider template
- [ ] Provider migration tools
- [ ] Advanced configuration options

### Consolidation Plan

#### From `normalizers` package

- Move to `providers/openai/normalizers/`
- Move to `providers/anthropic/normalizers/`
- Integrate into provider adapters
- Delete standalone normalizers package

#### From `adapters` package (DELETE THIS)

- Move adapter code into respective provider directories
- OpenAI adapter → `providers/openai/adapter.ts`
- Anthropic adapter → `providers/anthropic/adapter.ts`
- Delete standalone `adapters` package entirely

#### New Provider Structure - All-in-One Provider Ecosystem

```
packages/providers/src/
├── index.ts                    # Public exports
├── core/
│   ├── provider.ts            # Provider interfaces
│   ├── manager.ts             # ProviderManager
│   ├── client.ts              # UniversalClient
│   └── router.ts              # Request routing
├── openai/
│   ├── provider.ts            # OpenAI provider
│   ├── adapter.ts             # OpenAI adapter (moved from adapters/)
│   ├── parser.ts              # OpenAI chunk parser (moved from processor)
│   ├── normalizers/           # Request/response normalization
│   ├── client.ts              # OpenAI client implementation
│   └── models.ts              # OpenAI model definitions
├── anthropic/
│   ├── provider.ts            # Anthropic provider
│   ├── adapter.ts             # Anthropic adapter (moved from adapters/)
│   ├── parser.ts              # Anthropic chunk parser (moved from processor)
│   ├── normalizers/           # Request/response normalization
│   ├── client.ts              # Anthropic client implementation
│   └── models.ts              # Anthropic model definitions
├── universal/
│   ├── api-client.ts          # Universal API client (NEW)
│   ├── request-builder.ts     # Universal request building
│   ├── response-parser.ts     # Universal response parsing
│   └── stream-handler.ts      # Universal streaming
├── custom/
│   ├── template.ts            # Custom provider template
│   └── examples/              # Example implementations
└── registry/
    ├── models.ts              # Model registry
    ├── parsers.ts             # Parser registry (moved from processor)
    └── capabilities.ts        # Capability detection
```

### Verification Criteria

- [ ] All major providers work through universal interface
- [ ] Token counting is accurate across providers
- [ ] Model selection returns optimal results
- [ ] Provider registration/deregistration works
- [ ] Normalization preserves all necessary data
- [ ] Error handling is robust and consistent

### Risk Register

- **Medium**: Provider-specific API changes breaking compatibility
- **Medium**: Complex normalization logic between providers
- **Low**: Performance overhead from universal abstraction
- **Low**: Migration complexity from absorbed packages
