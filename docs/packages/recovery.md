# `@agentsy/core/recovery`

- **Status:** Published subpath export from `@agentsy/core`
- **Role:** Recovery snapshots and continuation helpers

## Where it fits

Use `@agentsy/core/recovery` when your workflow needs to resume, continue, or stabilize interrupted generation paths.

## Current surface

- `captureStreamState`
- `buildContinuationPrompt`

## Available APIs

- stream snapshot capture from a processor instance
- provider-aware continuation prompt construction

## Common neighbors

- `@agentsy/core/processor`
- `@agentsy/orchestrator/agent`

## Implementation example with neighbors

```ts
import { LLMStreamProcessor } from "@agentsy/core/processor";
import {
  buildContinuationPrompt,
  captureStreamState,
} from "@agentsy/core/recovery";

const processor = new LLMStreamProcessor({ parseThinkTags: true });

const snapshot = captureStreamState(processor);
const continuationMessages = buildContinuationPrompt(snapshot, {
  provider: "openai",
});

console.log(continuationMessages);
```
