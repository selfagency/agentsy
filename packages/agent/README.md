# @agentsy/agent

Multi-step agent loop orchestration.

## Purpose

`@agentsy/agent` runs iterative agent loops with stop conditions, tool result feedback, and step lifecycle control.

## Role in Agentsy

This package composes `processor`, `tool-calls`, and surrounding infrastructure into reusable agent-run behavior.

## Status

- Published `@agentsy` package.

## When to install it

Install this package when a single model response is not enough and you need iterative tool-use or multi-step orchestration.

Typical neighbors:

- `@agentsy/processor` for lower-level stream handling
- `@agentsy/tool-calls` for tool request/result shaping
- `@agentsy/renderers` or `@agentsy/ui` for projection of loop output

## API overview

- `createAgentLoop`
- `detectDoomLoop`
- `finishReasonIs`
- `hasNoToolCalls`
- `isStepCount`

## Usage

```ts
import { createAgentLoop, isStepCount } from '@agentsy/agent';
import { buildToolResultMessage } from '@agentsy/tool-calls';

const loop = createAgentLoop({
  execute,
  stopWhen: [isStepCount(5)],
  buildToolResultMessages: async toolCalls => toolCalls.map(call => buildToolResultMessage(call, { ok: true })),
});
```

## Learn more

- [Package page](https://agentsy.self.agency/packages/agent)
- [Platform evolution](https://agentsy.self.agency/architecture/platform-evolution)

## Development

```bash
cd packages/agent
pnpm build
pnpm check-types
pnpm test
```
