# @agentsy/context

Context-shaping primitives for agent systems.

`@agentsy/context` provides host-agnostic helpers for:

- conversation compression
- output compression
- drift/coherence analysis
- manual compaction summaries
- rewind markers and hydration helpers
- compression-linked observability primitives

## Installation

```bash
pnpm add @agentsy/context @agentsy/core @agentsy/types
```

## Stable APIs

- `compressConversation`
- `compressOutput`
- `compressOutputDetailed`
- `compressOutputV2`
- `createManualCompaction`
- `createCompactionSummarySchema`
- `findAnchors`
- `scoreCoherence`
- `createDriftMonitor`
- `createTokenLedger`
- `createRewindStore`
- `createCompressionMetrics`
- `createHydrationPolicy`

## Boundary rule

This package is a library package. It does **not** own:

- setup or doctor UX
- host/editor/protocol integration shells
- helper/background agent orchestration
- broad compatibility matrices
- heavyweight operator runbooks

Those concerns belong to `@agentsy/cli`, `@agentsy/orchestrator`, `@agentsy/runtime`, and host-facing integration packages.

## Quick start

### Compress conversation history

```ts
import { compressConversation } from '@agentsy/context';

const result = compressConversation(messages, {
  maxTokens: 200_000,
  preserveLast: 2,
  estimateTokens: message => Math.ceil(JSON.stringify(message).length / 4)
});

console.log(result.messages.length);
console.log(result.droppedCount);
console.log(result.estimatedTokens);
```

### Compress output

```ts
import { compressOutput } from '@agentsy/context';

const result = compressOutput(source, {
  level: 'full',
  preserve: ['code', 'urls', 'paths', 'markdown', 'errors']
});

console.log(result.compressed);
console.log(result.savingsRatio);
```
