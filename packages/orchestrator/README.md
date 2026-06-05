# @agentsy/orchestrator

Orchestration utilities for coordinating multi-step execution flows.

## Status

Internal package with evolving orchestration contracts.

## Exports

### Model-tier routing (delegates to `@agentsy/gateway`)

```typescript
import { GatewayBackedModelRouter } from '@agentsy/orchestrator';

const router = new GatewayBackedModelRouter(gatewayClient);

// Select a model for a task at the given complexity tier
const model = await router.chooseModelForTask({
  node: workflowNode,
  taskTier: 'mid'  // 'micro' | 'small' | 'mid' | 'frontier'
});
```

- `TaskTier` — re-export of `ModelTier` from `@agentsy/gateway`
- `TierAwareModelRouter` — interface for model selection per task
- `GatewayBackedModelRouter` — implementation delegating to `DefaultTierAwareModelSelector`
- Use case inference from node type/name (chat/code/search/embed/vision)
