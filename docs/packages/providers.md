# `@agentsy/providers`

- **Status:** Published workspace package
- **Role:** Provider-facing package root for adapters, normalizers, SSE pipeline helpers, and universal-client abstractions

## Where it fits

`@agentsy/providers` is the boundary where provider-specific concerns live.

Use it when you are dealing with:

- raw provider event normalization
- provider-specific outbound message adapters
- opinionated SSE pipeline assembly via `createPipeline`
- future provider-universal client abstractions

## Current subpath exports

- `@agentsy/providers/normalizers`
- `@agentsy/providers/adapters`
- `@agentsy/providers/pipeline`
- `@agentsy/providers/universal-client`

## Common neighbors

- Core processing: `@agentsy/core/processor`
- Core SSE parsing: `@agentsy/core/sse`
- Core structured parsing: `@agentsy/core/structured`
- Core tool-call helpers: `@agentsy/core/tool-calls`
- Downstream integrations: `@agentsy/renderers`, `@agentsy/ui`, `@agentsy/vscode`

## Example

```ts
import { normalizeOpenAIChatChunk } from '@agentsy/providers/normalizers';
import { createPipeline } from '@agentsy/providers/pipeline';
import { processStream } from '@agentsy/providers/adapters';
```

## Notes

Keep provider-specific responsibilities here. If the code is provider-agnostic stream processing or parsing infrastructure, it likely belongs under `@agentsy/core/*` instead.
