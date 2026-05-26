# Phase 3 — Model Selection & Provider Routing

**Effort:** ~5 hours  
**Packages:** `@agentsy/models`, `@agentsy/providers`, `@agentsy/plugins`, `@agentsy/renderers`, `@agentsy/cli`  
**Gate:** Model selection working; local provider probing functional  
**Next:** Phase 3.5

---

## Overview

Enable user to select from multiple providers/models. Add local LLM discovery (Ollama, vLLM, etc). Wire slash commands for model/provider management.

---

## TASK-013: Model Selector Integration

**Owner:** Models team  
**Effort:** ~1 hour

```typescript
export interface ModelSelection {
  providerId: string;
  modelId: string;
  criteria?: SelectionCriteria;
}

export interface SelectionCriteria {
  minTokens?: number;
  maxCost?: number;
  capabilities?: string[]; // tool-use, vision, streaming
  local?: boolean;
}

export async function selectModel(criteria?: SelectionCriteria): Promise<ModelSelection> {
  // Score all available models against criteria
  // Return top recommendation + alternatives
}
```

Wire into CLI chat path with recommendation + user override flow.

---

## TASK-014: Provider Capability Bridge

**Owner:** Models + Providers teams  
**Effort:** ~1.5 hours

```typescript
export interface ProviderCapabilities {
  toolUse: boolean;
  vision: boolean;
  streaming: boolean;
  structuredOutput: boolean;
  functionCalling: boolean;
}

export function getProviderCapabilities(providerId: string): ProviderCapabilities {
  // Query provider profile
  // Return static map or dynamic probe
}

// Gate model selection on provider capabilities
export async function selectModelForProvider(providerId: string, criteria: SelectionCriteria): Promise<ModelId> {
  const caps = getProviderCapabilities(providerId);
  // Filter models by provider capabilities + user criteria
}
```

---

## TASK-016: Local Provider Discovery

**Owner:** Providers team  
**Effort:** ~1.5 hours

Probe 8 local targets for health/models:

```typescript
const LOCAL_TARGETS = [
  'http://localhost:11434', // Ollama default
  'http://localhost:8000', // vLLM
  'http://localhost:1234', // LM Studio
  'http://localhost:8888' // Lemonade
  // ... 4 more
];

export async function discoverLocalProviders(): Promise<LocalProvider[]> {
  const found: LocalProvider[] = [];

  for (const target of LOCAL_TARGETS) {
    try {
      const health = await probeProvider(target, 2000); // 2s timeout
      if (health.ok) {
        const models = await fetchModelList(target);
        found.push({ target, models, health });
      }
    } catch {
      // Not available; continue
    }
  }

  return found;
}

export interface LocalProvider {
  target: string;
  models: ModelProfile[];
  health: HealthStatus;
}
```

Cache results for 5 minutes; invalidate on error.

---

## TASK-018: Model Selector Integration Tests

**Owner:** Models team  
**Effort:** ~0.5 hours

```typescript
test('deterministic routing', async () => {
  // Mock provider registry
  // Test criteria → model selection
  // Verify score consistency
});

test('capability gating', async () => {
  // Provider supports vision: true
  // Criteria requests vision
  // Only vision models returned
});

test('local provider discovery', async () => {
  // Mock 2 Ollama instances
  // Probe + collect
  // Verify deduplication
});
```

---

## TASK-015: Slash Commands for Model/Provider

**Owner:** Plugins + CLI teams  
**Effort:** ~0.5 hours

```typescript
export const modelCommands = [
  {
    name: 'search',
    description: 'Search models by criteria',
    handler: async (query: string) => {
      // Interactive search + select
    }
  },
  {
    name: 'select',
    description: 'Select a model',
    handler: async (modelId: string) => {
      // Switch to model
    }
  },
  {
    name: 'refine',
    description: 'Adjust selection criteria',
    handler: async () => {
      // Interactive refinement
    }
  }
];

export const providerCommands = [
  {
    name: 'search',
    description: 'Discover available providers',
    handler: async () => {
      // List + sort
    }
  }
];
```

Register in `@agentsy/plugins` slash registry.

---

## TASK-086: Search/Select/Refine Flows

**Owner:** Renderers + CLI teams  
**Effort:** ~1.5 hours

### 1. Model Search

```typescript
export const ModelSearchFlow: React.FC = () => {
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<ModelProfile[]>([]);

  React.useEffect(() => {
    if (query.length > 2) {
      setResults(searchModels(query));
    }
  }, [query]);

  return (
    <Box flexDirection=\"column\">
      <SearchInput value={query} onChange={setQuery} />
      <ModelList models={results} onSelect={handleSelect} />
    </Box>
  );
};
```

### 2. Provider Discovery

```typescript
export const ProviderDiscoveryFlow: React.FC = () => {
  const [providers, setProviders] = React.useState<LocalProvider[]>([]);

  React.useEffect(() => {
    discoverLocalProviders().then(setProviders);
  }, []);

  return (
    <ProviderList
      providers={providers}
      onSelect={handleSelect}
      loading={!providers.length}
    />
  );
};
```

### 3. Capability Refine

```typescript
export const CapabilityRefineFlow: React.FC = () => {
  const [criteria, setCriteria] = React.useState<SelectionCriteria>({});

  return (
    <Box>
      <Checkbox
        label=\"Tool use\"
        checked={criteria.capabilities?.includes('tool-use')}
        onChange={() => { /* toggle */ }}
      />
      <Checkbox label=\"Vision\" ... />
      <Checkbox label=\"Streaming\" ... />
      <Button label=\"Search\" onPress={() => search(criteria)} />
    </Box>
  );
};
```

---

## Quality Gates

- ✅ Model selection deterministic (same criteria → same ranking)
- ✅ Local probing timeout protected (no 30s hangs)
- ✅ Caching validates (results refreshed on error)
- ✅ All tests pass

---

## Success Criteria

✅ User can select from multiple providers  
✅ User can select from multiple models per provider  
✅ Local LLM discovery works (Ollama, vLLM, etc)  
✅ Capability-based filtering works  
✅ Slash commands functional

---

**Next phase:** `06-PHASE-3.5-LLM-GATEWAY.md`
