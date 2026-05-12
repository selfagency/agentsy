# `@agentsy/ag-ui`

- **Status:** Published
- **Role:** AG-UI protocol bridge utilities

## Where it fits

Use `@agentsy/ag-ui` when your application needs to adapt the event model into AG-UI oriented workflows or protocol expectations.

## Available APIs

- `toAgUiStream`
- `convertEventStream`
- `createEventConverter`
- `toCopilotKitEvent`
- `toCustomUIEvent`
- `InterruptController`, `TimeoutInterrupt`, `createInterruptEvent`
- `StateManager`, `applyJsonPatches`, `computeStateDelta`, `createStateDeltaEvent`, `createStateSnapshotEvent`
- `toObservable`

## Common neighbors

- `@agentsy/ui`
- `@agentsy/processor`
- `@agentsy/orchestrator/agent`

## Implementation example with neighbors

```ts
import { toAgUiStream } from '@agentsy/runtime/ag-ui';

const agUiEvents = toAgUiStream(processedEventStream, { runId: 'run-1', threadId: 'thread-1' });

for await (const event of agUiEvents) {
  console.log(event.type);
}
```
