# `@agentsy/core/tool-calls`

- **Status:** Published subpath export from `@agentsy/core`
- **Role:** Tool-call extraction, accumulation, and payload helpers

## Key exports

- `extractXmlToolCalls`
- `ToolCallAccumulator`
- `buildNativeToolsPayload`
- `buildToolResultMessage`
- `buildXmlToolSystemPrompt`

## Available APIs

- XML tool-call extraction
- Incremental tool-call accumulation
- Tool system-prompt and tool-result message builders

## Where it fits

Use this package when your application needs reliable tool-call handling across partial chunks or wants helpers for XML-style tool prompting.

## Common neighbors

- `@agentsy/core/processor`
- `@agentsy/core/structured`
- `@agentsy/orchestrator/agent`

## Implementation example with neighbors

```ts
import { parseJson } from "@agentsy/core/structured";
import {
  buildToolResultMessage,
  extractXmlToolCalls,
} from "@agentsy/core/tool-calls";

const calls = extractXmlToolCalls(responseText, new Set(["search"]));

for (const call of calls) {
  const args = parseJson(call.input);
  const result = await runTool(call.name, args);
  const message = buildToolResultMessage(call, result);
  console.log(message);
}
```
