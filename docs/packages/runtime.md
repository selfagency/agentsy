# `@agentsy/runtime`

- **Status:** Published
- **Role:** Runtime loop execution, resumable snapshots, spawned task execution, and AG-UI protocol support via subpath exports

## Where it fits

Use `@agentsy/runtime` when your application needs resumable task execution, checkpoint persistence through `@agentsy/session`, workflow execution, or AG-UI protocol projection through `@agentsy/runtime/ag-ui`.

## Available APIs

- `createRuntimeExecutor`
- `createRuntimeLoop`
- `createRuntimeWorkflowExecutor`
- `loadRuntimeSnapshotFromSession`
- `saveRuntimeSnapshotToSession`
- `RuntimeTask`, `RuntimeWorkflowTask`, `RuntimeSnapshot`

## Subpath exports

- `@agentsy/runtime/ag-ui` for `toAgUiStream`, event converters, interrupt handling, observables, reasoning mappers, and state projection helpers.

## Common neighbors

- `@agentsy/session`
- `@agentsy/orchestrator/agent`
- `@agentsy/ui`
- `@agentsy/core/processor`

## Implementation example with neighbors

```ts
import { createRuntimeLoop } from '@agentsy/runtime';
import { createSessionStore } from '@agentsy/session';

const sessionStore = createSessionStore({ id: 'ops-session', values: {} });
const runtime = createRuntimeLoop({ sessionId: 'ops-session', sessionStore, maxDepth: 2 });

await runtime.execute([
  {
    id: 'collect-telemetry',
    async run() {
      // perform work
    }
  }
]);
```
