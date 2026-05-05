# @agentsy/ag-ui

AG-UI protocol mapping and adapter helpers.

## Purpose

`@agentsy/ag-ui` adapts agent/stream events into AG-UI-compatible event flows.

## Role in Agentsy

Used when integrating Agentsy output with AG-UI clients and protocol-aware frontends.

## Status

- Published `@agentsy` package.

## When to install it

Install this package when you need to adapt processor or UI events into AG-UI-compatible streams, state deltas, or observable-style integrations.

Typical neighbors:

- `@agentsy/ui`
- `@agentsy/processor`
- `@agentsy/agent`

## API overview

- `toAgUiStream`
- `convertEventStream`
- `createEventConverter`
- `toCopilotKitEvent`
- `toCustomUIEvent`
- `InterruptController`, `TimeoutInterrupt`, `createInterruptEvent`
- `StateManager`, `applyJsonPatches`, `computeStateDelta`, `createStateDeltaEvent`, `createStateSnapshotEvent`
- `toObservable`

## Usage

```ts
import { toAgUiStream } from '@agentsy/ag-ui';

const stream = toAgUiStream(processedEventStream, { runId: 'run-1' });
```

## Learn more

- `/docs/packages/ag-ui.md`

## Development

```bash
cd packages/ag-ui
pnpm build
pnpm check-types
pnpm test
```
