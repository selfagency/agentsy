# `@agentsy/recovery`

- **Status:** Published
- **Role:** Recovery snapshots and continuation helpers

## Where it fits

Use `@agentsy/recovery` when your workflow needs to resume, continue, or stabilize interrupted generation paths.

## Current surface

- `captureStreamState`
- `buildContinuationPrompt`

## Available APIs

- stream snapshot capture from a processor instance
- provider-aware continuation prompt construction

## Common neighbors

- `@agentsy/processor`
- `@agentsy/orchestrator/agent`

## Implementation example with neighbors

```ts
import { LLMStreamProcessor } from '@agentsy/processor';
import { buildContinuationPrompt, captureStreamState } from '@agentsy/recovery';

const processor = new LLMStreamProcessor({ parseThinkTags: true });

const snapshot = captureStreamState(processor);
const continuationMessages = buildContinuationPrompt(snapshot, { provider: 'openai' });

console.log(continuationMessages);
```
