# `@agentsy/orchestrator/agent`

- **Status:** Published
- **Role:** Multi-step agent loop orchestration

## Where it fits

`@agentsy/orchestrator/agent` sits above the stream-processing stack when a single generation is not enough and you need iterative steps, stop conditions, or tool-use loops.

## Key exports

- `createAgentLoop`
- `detectDoomLoop`
- `finishReasonIs`
- `hasNoToolCalls`
- `isStepCount`

## Available APIs

- Loop creation: `createAgentLoop`
- Stop conditions: `detectDoomLoop`, `finishReasonIs`, `hasNoToolCalls`, `isStepCount`
- Agent loop state and output-part types

## Use it when

- your app needs multi-step orchestration around tool calls
- you want reusable stop conditions rather than home-grown loop exits

## Common neighbors

- Upstream: `@agentsy/core/processor`, `@agentsy/core/tool-calls`, `@agentsy/core/structured`
- Downstream: `@agentsy/renderers`, `@agentsy/ui`, `@agentsy/vscode`

## Example

```ts
import { createAgentLoop, isStepCount } from "@agentsy/orchestrator/agent";

const loop = createAgentLoop({
  execute,
  stopWhen: isStepCount(5),
  buildToolResultMessages: async () => [],
});
```

## Implementation example with neighbors

```ts
import { createAgentLoop, isStepCount } from "@agentsy/orchestrator/agent";
import { buildToolResultMessage } from "@agentsy/core/tool-calls";

const loop = createAgentLoop({
  stopWhen: [isStepCount(6)],
  buildToolResultMessages: async (toolCalls) =>
    toolCalls.map((call) => buildToolResultMessage(call, { ok: true })),
});

for await (const part of loop.run([
  { role: "user", content: "Summarize the repository status." },
])) {
  if (part.type === "tool_call") {
    console.log("Tool requested:", part.call.name);
  }
}
```

## Planned evolution

The `plan/` docs suggest that runtime/session concepts may eventually expand around this layer. Those are roadmap concepts until separate packages exist.
