# `@agentsy/runtime/ag-ui`

- **Status:** Published as a subpath export of `@agentsy/runtime`
- **Role:** AG-UI protocol bridge utilities

## Where it fits

Use `@agentsy/runtime/ag-ui` when your application needs to adapt runtime or processor events into AG-UI oriented workflows or protocol expectations.

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
- `@agentsy/core/processor`
- `@agentsy/orchestrator/agent`
- `@agentsy/runtime`

## Implementation example with neighbors

```ts
import { toAgUiStream } from '@agentsy/runtime/ag-ui';

const agUiEvents = toAgUiStream(processedEventStream, {
  runId: 'run-1',
  threadId: 'thread-1'
});

for await (const event of agUiEvents) {
  console.log(event.type);
}
```
