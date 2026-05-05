# @agentsy/agent

Multi-step agent loop orchestration.

## Purpose

`@agentsy/agent` runs iterative agent loops with stop conditions, tool result feedback, and step lifecycle control.

## Role in Agentsy

This package composes `processor`, `tool-calls`, and surrounding infrastructure into reusable agent-run behavior.

## Status

- Internal/pre-release package in this monorepo.

## Usage

```ts
import { createAgentLoop, isStepCount } from '@agentsy/agent';

const loop = createAgentLoop({
  execute,
  stopWhen: [isStepCount(5)],
});
```

## Development

```bash
cd packages/agent
pnpm build
pnpm check-types
pnpm test
```
