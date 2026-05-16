# Models.dev Integration Strategy for Agentsy

## Executive Summary

Integrate models.dev API to provide dynamic model/provider information and enable intelligent model selection in the orchestrator. This will eliminate hardcoded model definitions and enable cost-aware, capability-aware model selection for tasks.

## Current Architecture Analysis

### Existing Components

1. **@agentsy/providers/universal-client**
   - Hardcoded provider endpoints and normalization logic
   - 11 providers hardcoded: openai, anthropic, gemini, bedrock, mistral, ollama, cohere, hugging-face, zai
   - Universal client abstraction but no model metadata

2. **@agentsy/orchestrator/agents/registry**
   - Agent registration with capabilities
   - Skill matching and proficiency levels
   - No model selection logic

3. **@agentsy/tokens**
   - Budget tracking and cost management
   - No model cost data sources

### Gaps Identified

1. **No model metadata**: Providers and models are hardcoded strings
2. **No capability matching**: Cannot select models based on task requirements
3. **No cost optimization**: Cannot select models based on cost/performance tradeoffs
4. **Limited provider support**: Only 11 providers vs 100+ in models.dev

## Models.dev API Analysis

### API Structure

```typescript
interface ModelsDevAPI {
  [providerId: string]: {
    id: string;
    env: string[]; // Required environment variables
    npm: string; // SDK package name
    api: string; // Base API endpoint
    name: string; // Provider display name
    doc: string; // Documentation URL
    models: {
      [modelId: string]: {
        id: string;
        name: string;
        family: string;
        attachment: boolean; // Supports attachments?
        reasoning: boolean; // Reasoning/thinking?
        tool_call: boolean; // Function calling?
        temperature: boolean; // Temperature parameter?
        knowledge: string; // Training cutoff
        release_date: string; // Release date
        last_updated: string; // Last update
        modalities: {
          input: string[]; // Vision, text, audio, etc.
          output: string[]; // Text, audio, etc.
        };
        open_weights: boolean; // Open source?
        limit: {
          context: number; // Input context window
          output: number; // Max output tokens
        };
        cost: {
          input: number; // Cost per 1M input tokens ($)
          output: number; // Cost per 1M output tokens ($)
          cache_read: number; // Cost for cached reads ($/1M)
          cache_write: number; // Cost for cache writes ($/1M)
        };
      };
    };
  };
}
```

### Provider Coverage

**Total Providers:** 100+ providers including:

- Major: anthropic, openai, google, azure, amazon-bedrock, deepseek, qwen
- Specialized: groq, together, fireworks, replicate, cerebras
- Open source: ollama, hugging-face, vllm, lm-studio
- Regional: alibaba, moonshot, zai, baichuan, 01ai
- API gateways: helicone, openrouter, together-proxy

**Sample Providers:**

```bash
$ curl -s https://models.dev/api.json | jq 'keys | .[]' | wc -l
100+

# Top 20 by model count:
$ curl -s https://models.dev/api.json | jq '.[] | .models | length' | sort -nr | head -20
```

## Integration Architecture

### Package: @agentsy/models

**Purpose:** Models.dev data access, model registry, and selection logic

#### Core Components

```typescript
// Model metadata types (matching models.dev API)
interface ModelsDevProvider {
  id: string;
  env: string[];
  npm?: string;
  api: string;
  name: string;
  doc: string;
  models: Record<string, ModelsDevModel>;
}

interface ModelsDevModel {
  id: string;
  name: string;
  family: string;
  attachment: boolean;
  reasoning: boolean;
  tool_call: boolean;
  temperature: boolean;
  knowledge: string;
  release_date: string;
  last_updated: string;
  modalities: {
    input: string[];
    output: string[];
  };
  open_weights: boolean;
  limit: {
    context: number;
    output: number;
  };
  cost: {
    input: number;
    output: number;
    cache_read?: number;
    cache_write?: number;
  };
}

// Task requirements for model selection
interface TaskRequirements {
  modality?: "text" | "multimodal" | "code" | "reasoning";
  capabilities?: {
    tool_calling?: boolean;
    streaming?: boolean;
    image_input?: boolean;
    image_output?: boolean;
    audio_input?: boolean;
    audio_output?: boolean;
  };
  constraints?: {
    max_cost?: number; // Maximum cost per request
    max_context?: number; // Minimum context window
    min_speed?: "fast" | "medium" | "slow";
    preferred_family?: string; // Prefer specific model family
    exclude_family?: string[]; // Exclude specific model families
  };
  specialization?: string; // "coding", "reasoning", "chat", "multimodal"
}

// Model selection results
interface ModelSelectionResult {
  model: string;
  provider: string;
  confidence: number; // 0-1 match score
  estimated_cost: number; // Estimated cost in $
  capabilities: TaskRequirements["capabilities"];
  reasoning: string;
}
```

### Key Modules

#### 1. ModelsDevClient

```typescript
class ModelsDevClient {
  private cache?: ModelsDevAPI;
  private lastFetched?: Date;
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  async fetchModelsDevData(): Promise<ModelsDevAPI> {
    // Cache models.dev data for 24 hours
    if (
      this.cache &&
      Date.now() - this.lastFetched!.getTime() < this.CACHE_TTL
    ) {
      return this.cache;
    }

    const response = await fetch("https://models.dev/api.json");
    const data = (await response.json()) as ModelsDevAPI;
    this.cache = data;
    this.lastFetched = new Date();
    return data;
  }

  getProvider(providerId: string): ModelsDevProvider | undefined {
    return this.cache?.[providerId];
  }

  getModel(modelId: string): ModelsDevModel | undefined {
    // Parse model ID (format: provider:model or model)
    const parts = modelId.includes(":") ? modelId.split(":") : [null, modelId];

    if (parts[0]) {
      const provider = this.getProvider(parts[0]);
      return provider?.models[parts[1]];
    }

    // Search for model ID across all providers
    for (const provider of Object.values(this.cache || {})) {
      if (provider.models[modelId]) {
        return provider.models[modelId];
      }
    }
    return undefined;
  }

  listProviders(): ModelsDevProvider[] {
    return Object.values(this.cache || {});
  }

  listModels(providerId?: string): ModelsDevModel[] {
    if (providerId) {
      const provider = this.getProvider(providerId);
      return Object.values(provider?.models || {});
    }
    return Object.values(this.cache ?? {}).flatMap((p) =>
      Object.values(p.models)
    );
  }
}
```

#### 2. ModelSelector

```typescript
class ModelSelector {
  constructor(private modelsDev: ModelsDevClient) {}

  /**
   * Select the best model for a task based on requirements and available models
   */
  async selectModel(
    requirements: TaskRequirements,
    availableModels?: string[] // User's available models
  ): Promise<ModelSelectionResult> {
    const allModels = this.modelsDev.listModels();
    const filteredModels = availableModels
      ? allModels.filter((m) => this.isModelAvailable(m.id, availableModels))
      : allModels;

    const scoredModels = filteredModels.map((model) => ({
      model,
      score: this.calculateMatchScore(model, requirements),
      cost: this.estimateCost(model, requirements),
    }));

    const sortedModels = scoredModels
      .filter((m) => m.score > 0.3) // Minimum match threshold
      .sort((a, b) => {
        // Sort by (score, cost) - prefer high match, low cost
        const scoreDiff = b.score - a.score;
        if (Math.abs(scoreDiff) > 0.1) return scoreDiff; // Significant capability difference
        return Math.sign(a.cost - b.cost); // Cost tiebreaker
      });

    if (sortedModels.length === 0) {
      throw new Error("No model matches requirements");
    }

    const best = sortedModels[0];
    const provider = this.modelsDev.getProvider(best.model.id.split(":")[0]);

    return {
      model: best.model.id,
      provider: provider.id,
      confidence: best.score,
      estimated_cost: best.cost,
      capabilities: this.extractCapabilities(best.model),
      reasoning: this.buildReasoning(best.model, requirements),
    };
  }

  private calculateMatchScore(
    model: ModelsDevModel,
    requirements: TaskRequirements
  ): number {
    let score = 0; // 0-1 scale

    // Check modality requirements
    if (requirements.modality === "multimodal") {
      if (!model.modalities.input.includes("image")) {
        return 0; // Veto: doesn't support images
      }
      score += 0.3;
    }

    // Check capability requirements
    if (requirements.capabilities?.tool_calling && !model.tool_call) {
      return 0; // Veto: doesn't support tools
    }
    if (requirements.capabilities?.tool_calling && model.tool_call) {
      score += 0.2;
    }

    if (requirements.capabilities?.streaming) {
      score += 0.1; // Assuming most support streaming
    }

    // Check specialization
    if (requirements.specialization === "reasoning" && !model.reasoning) {
      score -= 0.2; // Penalty for reasoning tasks without reasoning capability
    }
    if (requirements.specialization === "reasoning" && model.reasoning) {
      score += 0.3;
    }

    // Check constraints
    if (requirements.constraints?.max_context) {
      if (model.limit.context < requirements.constraints.max_context) {
        return 0; // Veto: context too small
      }
      score += Math.min(
        0.2,
        (model.limit.context - requirements.constraints.max_context) / 100000
      );
    }

    if (requirements.constraints?.max_cost) {
      const modelCost =
        (model.cost.input * 1000 + model.cost.output * 1000) / 1000000;
      if (modelCost > requirements.constraints.max_cost) {
        return 0; // Veto: too expensive
      }
      score +=
        ((requirements.constraints.max_cost - modelCost) /
          requirements.constraints.max_cost) *
        0.1;
    }

    // Family preferences
    if (requirements.constraints?.preferred_family) {
      if (model.family === requirements.constraints.preferred_family) {
        score += 0.2;
      }
    }

    if (requirements.constraints?.exclude_family?.includes(model.family)) {
      return 0; // Veto: excluded family
    }

    return Math.min(1, score);
  }

  private estimateCost(
    model: ModelsDevModel,
    requirements: TaskRequirements
  ): number {
    // Rough estimate: 10K input + 1K output tokens
    const inputTokens = 10000;
    const outputTokens = 1000;

    let cost =
      (model.cost.input * inputTokens + model.cost.output * outputTokens) /
      1000000;

    // Reasoning models may use more output tokens
    if (requirements.specialization === "reasoning") {
      cost *= 3; // Estimate 3x output for reasoning
    }

    // Multimodal tasks may use more input tokens
    if (requirements.modality === "multimodal") {
      cost *= 1.5;
    }

    return cost;
  }

  private extractCapabilities(
    model: ModelsDevModel
  ): TaskRequirements["capabilities"] {
    return {
      tool_calling: model.tool_call,
      streaming: true, // Assuming most support streaming
      image_input: model.modalities.input.includes("image"),
      image_output: model.modalities.output.includes("image"),
      audio_input: model.modalities.input.includes("audio"),
      audio_output: model.modalities.output.includes("audio"),
    };
  }

  private buildReasoning(
    model: ModelsDevModel,
    requirements: TaskRequirements
  ): string {
    const reasons = [`Matched ${model.family} family`];

    if (requirements.modality) {
      reasons.push(`Supports ${requirements.modality} modality`);
    }
    if (model.reasoning) {
      reasons.push("Has reasoning capability");
    }
    if (model.cost.input < 3) {
      reasons.push("Cost-efficient (low input cost)");
    }
    if (model.limit.context > 100000) {
      reasons.push("Large context window");
    }

    return reasons.join(". ");
  }

  private isModelAvailable(
    modelId: string,
    availableModels: string[]
  ): boolean {
    return availableModels.some((available) => {
      if (available === modelId) return true;
      // Support wildcard provider:model matching (e.g., "anthropic:*" for all Anthropic models)
      if (available.includes("*")) {
        const [provider, model] = modelId.split(":");
        return (
          available.endsWith("*") && available.replace("*", "") === provider
        );
      }
      return false;
    });
  }
}
```

#### 3. AvailableModelsManager

```typescript
class AvailableModelsManager {
  private availableModels: Set<string> = new Set();

  /**
   * Load available models from configuration
   */
  async loadAvailableModels() {
    // Priority: environment variable > config file > default
    const envModels = process.env.AGENTS_MODELS?.split(",");
    const configModels = await this.loadFromConfig();

    if (envModels && envModels.length > 0) {
      this.availableModels = new Set(envModels);
    } else if (configModels && configModels.length > 0) {
      this.availableModels = new Set(configModels);
    } else {
      // Default: all models from models.dev (dev mode)
      const models = await modelsDevClient.listModels();
      this.availableModels = new Set(
        models.map((m) => `${m.providerId}:${m.id}`)
      );
    }
  }

  getAvailableModels(): string[] {
    return Array.from(this.availableModels);
  }

  addModel(modelId: string) {
    this.availableModels.add(modelId);
  }

  removeModel(modelId: string) {
    this.availableModels.delete(modelId);
  }
}
```

### Integration with @agentsy/orchestrator

#### Enhanced Agent Registration

```typescript
// New fields for AgentCapabilities
interface EnhancedAgentCapabilities extends AgentCapabilities {
  modelPreferences?: {
    preferredModels?: string[]; // Preferred models for this agent
    requiredCapabilities?: TaskRequirements; // Required model capabilities
    maxModelCost?: number; // Maximum cost per model call
  };
}

// Enhanced agent registry with model selection
class ModelAwareAgentRegistry extends AgentRegistry {
  private modelSelector: ModelSelector;
  private availableModelsManager: AvailableModelsManager;

  constructor() {
    super();
    this.modelSelector = new ModelSelector(modelsDevClient);
    this.availableModelsManager = new AvailableModelsManager();
  }

  /**
   * Find agents that can handle a task, accounting for model requirements
   */
  async findAgentsWithModelMatch(
    taskRequirements: TaskRequirements,
    requiredSkills: RequiredSkills[]
  ): Promise<{ agent: AgentCapabilities; model: ModelSelectionResult }[]> {
    const skillAgents = this.findAgentsBySkills(requiredSkills);

    const results = [];
    for (const agent of skillAgents) {
      if (agent.modelPreferences?.requiredCapabilities) {
        const modelResult = await this.modelSelector.selectModel(
          agent.modelPreferences.requiredCapabilities,
          this.availableModelsManager.getAvailableModels()
        );
        if (modelResult.confidence > 0.5) {
          // Only include good matches
          results.push({ agent, model: modelResult });
        }
      }
    }

    return results;
  }

  /**
   * Register agent with model preferences
   */
  registerWithPreferences(agent: EnhancedAgentCapabilities): void {
    this.register(agent);
  }
}
```

#### Orchestration Engine Integration

```typescript
class ModelAwareOrchestrationEngine {
  constructor(
    private agentRegistry: ModelAwareAgentRegistry,
    private tokenBudget: TokenBudgetManager
  ) {}

  async orchestrateTask(
    taskDescription: string,
    requiredSkills: RequiredSkills[],
    availableBudget?: number
  ): Promise<{
    agent: AgentCapabilities;
    model: ModelSelectionResult;
    executionPlan: ExecutionPlan;
  }> {
    // 1. Analyze task requirements
    const taskRequirements = await this.analyzeTask(taskDescription);

    // 2. Find matching agents and models
    const matches = await this.agentRegistry.findAgentsWithModelMatch(
      taskRequirements,
      requiredSkills
    );

    if (matches.length === 0) {
      throw new Error(`No agent/model combination matches task requirements`);
    }

    // 3. Select best match based on cost and confidence
    const selected = this.selectBestMatch(matches, availableBudget);

    // 4. Verify budget
    await this.tokenBudget.verifyBudget(
      selected.model.model,
      selected.model.estimatedCost
    );

    // 5. Return execution plan
    return {
      agent: selected.agent,
      model: selected.model,
      executionPlan: this.buildExecutionPlan(selected),
    };
  }

  private selectBestMatch(
    matches: { agent: AgentCapabilities; model: ModelSelectionResult }[],
    availableBudget?: number
  ): { agent: AgentCapabilities; model: ModelSelectionResult } {
    // Score based on: model confidence * agent proficiency * cost factor
    return matches
      .map((match) => ({
        ...match,
        score:
          match.model.confidence *
          this.getAgentProficiency(match.agent) *
          this.getCostFactor(match.model.estimated_cost, availableBudget),
      }))
      .sort((a, b) => b.score - a.score)[0];
  }
}
```

### Integration with @agentsy/providers

#### Dynamic Provider Configuration

```typescript
class DynamicProviderRegistry {
  private modelsDev: ModelsDevClient;

  async configureProvider(
    providerId: string,
    apiKey: string
  ): Promise<UniversalClientConfig> {
    const provider = this.modelsDev.getProvider(providerId);

    if (!provider) {
      throw new Error(`Unknown provider: ${providerId}`);
    }

    // Check required environment variables
    const missingEnv = provider.env.filter((env) => !process.env[env]);
    if (missingEnv.length > 0) {
      throw new Error(
        `Missing required env vars for ${providerId}: ${missingEnv.join(", ")}`
      );
    }

    return {
      provider: providerId as NormalizerProvider,
      apiKey,
      baseUrl: provider.api,
    };
  }

  async listProviders(): Promise<ProviderDefinition[]> {
    const providers = this.modelsDev.listProviders();

    return providers.map((p) => ({
      id: p.id,
      name: p.name,
      capabilities: {
        streaming: true,
        toolCalling: this.getProviderCapability(p, "tool_calling"),
        batching: false,
        reasoning: this.getProviderCapability(p, "reasoning"),
      },
    }));
  }

  async listModels(providerId?: string): Promise<ModelsDevModel[]> {
    return this.modelsDev.listModels(providerId);
  }

  private getProviderCapability(
    provider: ModelsDevProvider,
    capability: string
  ): boolean {
    return Object.values(provider.models).some((model) =>
      this.isCapable(model, capability)
    );
  }

  private isCapable(model: ModelsDevModel, capability: string): boolean {
    switch (capability) {
      case "tool_calling":
        return model.tool_call;
      case "reasoning":
        return model.reasoning;
      default:
        return false;
    }
  }
}
```

## Implementation Plan

### Phase 1: Foundation (Weeks 1-3)

**Week 1:**

1. Create `@agentsy/models` package
2. Implement `ModelsDevClient` with cache
3. Add type definitions matching models.dev API
4. Fetch and cache models.dev data on startup

**Week 2:**

1. Implement `ModelSelector` with task requirements
2. Implement match scoring algorithm
3. Add unit tests for selection logic
4. Test against known scenarios

**Week 3:**

1. Implement `AvailableModelsManager`
2. Add environment/config loading
3. Integrate with token budgeting
4. Document API surface

### Phase 2: Orchestration Integration (Weeks 4-6)

**Week 4-5:**

1. Enhance `AgentRegistry` with model preferences
2. Add `findAgentsWithModelMatch` method
3. Update agent registration to include model preferences
4. Add integration tests

**Week 6:**

1. Update `OrchestrationEngine` with model selection
2. Add task requirement analysis
3. Implement cost verification
4. End-to-end orchestration tests

### Phase 3: Provider Integration (Weeks 7-8)

**Week 7:**

1. Implement `DynamicProviderRegistry`
2. Auto-configure providers from models.dev
3. Update `createUniversalClient` to use dynamic config
4. Add provider discovery API

**Week 8:**

1. Add provider logo support `/logos/{provider}.svg`
2. Implement provider health checks
3. Add provider recommendation engine
4. Documentation and examples

### Phase 4: UI/CLI Support (Weeks 9-10)

**Week 9:**

1. Add CLI commands for model discovery:

   ```text
   agentsy models list [--provider <id>]
   agentsy models info <model-id>
   agentsy models search <query>
   ```

2. Add CLI commands for cost estimation:

   ```text
   agentsy estimate <task-description> [--provider <id>] [--model <id>]
   ```

3. Add interactive model selection wizard

**Week 10:**

1. Add web UI for model/management
2. Visual model comparison chart
3. Cost calculator tool
4. Setup and deployment documentation

## Benefits

### 1. Eliminates Hardcoding

- **Before:** 11 providers hardcoded, need PR for each new provider
- **After:** 100+ providers, automatic updates from models.dev

### 2. Intelligent Model Selection

- **Before:** Manual model selection per agent/task
- **After:** Automatic selection based on:
  - Task requirements (modality, capabilities, specialization)
  - Cost optimization
  - User's available models
  - Performance preferences

### 3. Cost Transparency

- **Before:** Unknown costs until after usage
- **After:** Pre-execution cost estimates with reasoning

### 4. Future-Proof

- **Before:** Manual updates for new models
- **After:** Automatic updates via models.dev caching

### 5. Better Agent Matching

- **Before:** Only skill-based agent matching
- **After:** Skill + model + cost matching

## Example Usage

### CLI Usage

```bash
# List all available models
$ agentsy models list

Output:
Provider: anthropic
  claude-3.7-sonnet          $3.00 input, $15.00 output, 200K context
  claude-opus-4.1-20250805  $15.00 input, $75.00 output, 200K context (reasoning)

Provider: openai
  gpt-4o                    $5.00 input, $20.00 output, 128K context
  gpt-4-turbo                $0.50 input, $2.00 output, 128K context

# Select model for task
$ agentsy model select "Parse markdown documentation"

Selected model: claude-3.7-sonnet ($3.00M input, $15.00M output)
Reasoning: Matched claude-sonnet family. Supports tool calling. Cost-efficient.

# Estimate cost
$ agentsy estimate "Write a blog post about AI" --model claude-3.7-sonnet

Estimated cost: $0.12 (assuming 8K input + 1K output tokens)
```

### Agent Registration

```typescript
// In agent configuration
agentRegistry.registerWithPreferences({
  id: 'documentation-agent',
  skills: [
    { name: 'markdown-parsing', proficiency: 'expert' },
    { name: 'code-generation', proficiency: 'advanced' },
  ],
  modelPreferences: {
    preferredModels: ['anthropic:claude-3.7-sonnet', 'openai:gpt-4o'],
    requiredCapabilities: {
      modality: 'text',
      capabilities: { tool_calling: true }
    },
    maxModelCost: 0.10,  // $0.10 per request
  }
});

// Model is auto-selected based on available models and budget
await orchestrationEngine.orchestrateTask('Parse docs', [...]);
```

### Orchestration Flow

```typescript
// User provides task
const task = "Analyze codebase security vulnerabilities";

// System analyzes task requirements
const analysis = await modelSelector.selectModel(
  {
    modality: "text",
    capabilities: { tool_calling: true },
    specialization: "coding",
    constraints: { max_cost: 0.05 },
  },
  ["anthropic:claude-3.7-sonnet*", "openai:gpt-4*"]
);

// Result:
// {
//   model: 'anthropic:claude-3-3-sonnet',
//   provider: 'anthropic',
//   confidence: 0.92,
//   estimated_cost: 0.032,
//   reasoning: 'Matched claude-sonnet family. Supports tool calling. Cost-efficient. Fits within budget.'
// }

// Orchestrator executes with selected model
const result = await orchestrationEngine.orchestrateTask(
  task,
  [{ name: "security-analysis", proficiency: "advanced" }],
  analysis.estimated_cost
);
```

## Cost Optimization Examples

### Scenario: Code Review Task

**Requirements:** Tool calling, text-only, max $0.05

**Available Models:**

- `claude-3.7-sonnet`: $0.018 (1K input + 1K output) ✓
- `gpt-4o`: $0.025 ✓
- `claude-opus-4.1`: $0.090 (over budget) ✗

**Selection:** `claude-3.7-sonnet` (cheapest that meets requirements)

### Scenario: Reasoning Task

**Requirements:** Reasoning capability, max $0.15

**Available Models:**

- `claude-opus-4.1`: $0.090, reasoning ✓
- `claude-3.7-sonnet`: $0.018, no reasoning ✗

**Selection:** `claude-opus-4.1` (only model with reasoning within budget)

### Scenario: High-Volume Chat

**Requirements:** Tool calling, fast response, max $0.01 per 100 calls

**Available Models:**

- `llama-3.1-8b-instant`: $0.00004, tool_call=false ✗
- `gemma2-9b-it`: $0.00013, tool_call=false ✗
- `claude-3.5-haiku`: $0.00032, tool_call=false ✗

**Tradeoff Analysis:** May need to relax tool_calling requirement or budget constraint

## Future Enhancements

### Phase 5: Advanced Features (Weeks 11-14)

1. **Model Warmup Strategy**
   - Pre-warm recently used models
   - Connection pooling for high-volume usage

2. **Model Fallback Hierarchy**
   - Primary → Secondary → Tertiary
   - Automatic fallback on errors or timeouts

3. **Cost Prediction ML**
   - Predictive cost estimation based on task type
   - Historical cost data analysis

4. **Custom Model Registry**
   - Support for zero-to-one models
   - Custom model metadata (specialization, pricing)

5. **Regional Model Discovery**
   - Discover region-specific providers (e.g., Alibaba for China)
   - Latency-based model selection

## Risks and Mitigations

### 1. API Availability

- **Risk:** models.dev API goes down or changes
- **Mitigation:** 24-hour cache with fallback to local cache file

### 2. Model Accuracy

- **Risk:** models.dev metadata may be outdated
- **Mitigation:** Regular cache refresh, allow manual overrides

### 3. Provider Updates

- **Risk:** Provider changes break integration
- **Mitigation:** Version locking, semantic versioning

### 4. Performance Overhead

- **Risk:** Selection logic adds latency
- **Mitigation:** Cache model availability, precompute matches

### 5. Complexity

- **Risk:** Too many options confuse users
- **Mitigation:** Smart defaults, simple 80% use cases

## Migration Path

### For Existing Code

**Before:**

```typescript
const client = createUniversalClient({
  provider: 'anthropic',
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const response = await client.complete({
  model: 'claude-3-7-sonnet',
  messages: [...],
});
```

**After:**

```typescript
// Option 1: Let system select model
const result = await orchestrationEngine.orchestrateTask(
  taskDescription,
  requiredSkills,
);

const response = await result.client.complete({
  model: result.model.model,
  messages: [...],
});

// Option 2: Manual selection with validation
const modelResult = await modelSelector.selectModel(
  { modality: 'text', capabilities: { tool_calling: true } },
  getAvailableModels()
);

const response = await complete({
  model: modelResult.model,
  messages: [...],
  reasoning: modelResult.reasoning,
});
```

### For New Users

**Setup:**

```bash
# Configure available models (one-time)
export AGENTS_MODELS="anthropic:claude-3.7-sonnet,openai:gpt-4o,deepseek-coder-6.7b:free"

# Or use all available models from provider
export AGENTS_MODELS="anthropic:*"

# Start using agents
agentsy todo "Add user authentication to app"
```

## Success Metrics

### Cost Metrics

- **Cost prediction accuracy:** ±10% within actual costs
- **Model selection cost:** Within 20% of optimal cost
- **Infrastructure savings:** 60% total reduction (combined with token optimization)

### Performance Metrics

- **Selection latency:** < 100ms for model selection
- **Cache hit rate:** > 95% for models.dev data
- **UI responsiveness:** < 200ms for model discovery UI

### Adoption Metrics

- **CLI usage:** 50% of commands use auto-selection
- **Cost-aware users:** 30% of users check costs before execution
- **Provider diversity:** Support for 20+ providers (vs current 11)

---

## Next Steps

1. **Create @agentsy/models package** (Week 1)
2. **Implement models.dev data fetching** (Week 1)
3. **Add model selection logic** (Week 2)
4. **Integrate with orchestrator** (Week 4-5)
5. **Add CLI commands** (Week 9)
6. **Document and test** (Week 10)

This integration will provide Agentsy with industry-standard model metadata while maintaining our differentiated架构 in token optimization and agent orchestration.
