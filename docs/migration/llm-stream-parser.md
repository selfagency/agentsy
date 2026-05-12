# Migrating from `@selfagency/llm-stream-parser`

This guide documents the migration path from the old single-package library, [`@selfagency/llm-stream-parser`](https://www.npmjs.com/package/@selfagency/llm-stream-parser), to the current `@agentsy/*` package family.

The baseline for this guide is the published `v0.3.1` release of `@selfagency/llm-stream-parser`, corresponding to commit [`f6b71cc`](https://github.com/selfagency/agentsy/commit/f6b71ccf30d8a1d6cbee3c42f3dfaf881f633399).

## What changed

`@selfagency/llm-stream-parser` bundled stream parsing, agent loops, renderers, UI state, and VS Code integration into one package.

`@agentsy` decomposes that monolith into focused packages so consumers can install only what they need.

That means migration usually happens on **three levels**:

1. **Install migration** — replace one package install with a smaller package set.
2. **Import migration** — change old subpath imports to current package imports.
3. **Conceptual migration** — move from a monolith mental model to a layered ecosystem:
   `normalizers` → `processor` → `agent` / `adapters` / `renderers` / `ui`.

## Before you migrate

- **Published today:** the current `@agentsy/*` package family in this repository
- **Private:** `@agentsy/integration`

If you only used the old VS Code chat renderer or provider utilities, migration is straightforward and production-oriented today.

If you depended on deeper monolith surfaces like agent loops, UI state, pipeline transforms, or multiple renderer variants, the equivalents now exist as focused published packages in this repository. The main caveat is not package availability; it is whether a historical monolith subpath still has a direct modern public export path.

## Choose the smallest modern package set

| If you used `@selfagency/llm-stream-parser` for… | Start with…                   | Notes                                                                                                               |
| ------------------------------------------------ | ----------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| VS Code chat providers and renderers             | `@agentsy/vscode`             | Best-supported migration path today.                                                                                |
| Thinking extraction                              | `@agentsy/thinking`           | Direct focused replacement.                                                                                         |
| XML/privacy scrubbing                            | `@agentsy/xml-filter`         | Direct focused replacement.                                                                                         |
| Context block splitting and dedupe               | `@agentsy/context`            | Direct focused replacement.                                                                                         |
| XML/native tool-call extraction                  | `@agentsy/tool-calls`         | Direct focused replacement.                                                                                         |
| JSON parsing / validation / repair               | `@agentsy/structured`         | Direct focused replacement.                                                                                         |
| Provider event normalization                     | `@agentsy/normalizers`        | Pair with `@agentsy/processor`.                                                                                     |
| Stream orchestration / transforms                | `@agentsy/processor`          | Includes processor, pipeline helpers, and SSE helpers.                                                              |
| Generic integration adapters                     | `@agentsy/adapters`           | High-level utilities including `processRawStream`, `runStructuredDecisionFromRawStream`, and `applyDecisionAction`. |
| Event-sourced UI state                           | `@agentsy/ui`                 | Store + reducer + processor bridge.                                                                                 |
| Agent loops                                      | `@agentsy/orchestrator/agent` | Equivalent capability, now separated from parsing primitives.                                                       |
| Formatting / markdown helper utilities           | `@agentsy/formatting`         | `appendToBlockquote` moved here.                                                                                    |

## Install migration

### Old monolith install

```bash
npm install @selfagency/llm-stream-parser
```

### New selective installs

#### VS Code extension authors

```bash
npm install @agentsy/vscode vscode
```

#### Stream parsing pipeline users

```bash
npm install @agentsy/normalizers @agentsy/processor @agentsy/thinking @agentsy/tool-calls @agentsy/structured @agentsy/xml-filter
```

#### Agent-loop users

```bash
npm install @agentsy/orchestrator/agent @agentsy/processor @agentsy/tool-calls @agentsy/structured
```

#### UI-state consumers

```bash
npm install @agentsy/ui @agentsy/processor
```

## Import mapping

The table below maps the main `v0.3.1` subpaths to their modern homes.

| Old import                                             | Current import                              | Migration note                                                                                                     |
| ------------------------------------------------------ | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `@selfagency/llm-stream-parser/processor`              | `@agentsy/processor`                        | `LLMStreamProcessor` and processor helpers live here.                                                              |
| `@selfagency/llm-stream-parser/pipeline`               | `@agentsy/processor`                        | Pipeline helpers like `createSmoothStream` now come from `@agentsy/processor`.                                     |
| `@selfagency/llm-stream-parser/thinking`               | `@agentsy/thinking`                         | Direct focused replacement.                                                                                        |
| `@selfagency/llm-stream-parser/xml-filter`             | `@agentsy/xml-filter`                       | Direct focused replacement.                                                                                        |
| `@selfagency/llm-stream-parser/context`                | `@agentsy/context`                          | Direct focused replacement.                                                                                        |
| `@selfagency/llm-stream-parser/tool-calls`             | `@agentsy/tool-calls`                       | Direct focused replacement.                                                                                        |
| `@selfagency/llm-stream-parser/structured`             | `@agentsy/structured`                       | Direct focused replacement.                                                                                        |
| `@selfagency/llm-stream-parser/normalizers`            | `@agentsy/normalizers`                      | Pair with `@agentsy/processor` for end-to-end stream handling.                                                     |
| `@selfagency/llm-stream-parser/adapters`               | `@agentsy/adapters`                         | Generic adapter surface moved here.                                                                                |
| `@selfagency/llm-stream-parser/agent`                  | `@agentsy/orchestrator/agent`               | Agent loop separated into its own package.                                                                         |
| `@selfagency/llm-stream-parser/ui`                     | `@agentsy/ui`                               | Event-sourced conversation state now lives here.                                                                   |
| `@selfagency/llm-stream-parser/formatting`             | `@agentsy/formatting`                       | Formatting helpers live here.                                                                                      |
| `@selfagency/llm-stream-parser/markdown`               | `@agentsy/formatting`                       | `appendToBlockquote` was folded into `@agentsy/formatting`.                                                        |
| `@selfagency/llm-stream-parser/renderers/plain`        | `@agentsy/renderers`                        | Use `createPlainTextRenderer` from the renderers package root.                                                     |
| `@selfagency/llm-stream-parser/renderers/vscode`       | `@agentsy/vscode`                           | VS Code renderer APIs moved into the published VS Code package.                                                    |
| `@selfagency/llm-stream-parser/renderers/cli`          | No stable one-to-one public replacement yet | The repo contains renderer work, but this old public subpath does not currently map to a documented stable export. |
| `@selfagency/llm-stream-parser/renderers/streaming-md` | No stable one-to-one public replacement yet | Treat as roadmap / internal until publicly documented and exported.                                                |
| `@selfagency/llm-stream-parser/renderers/ink`          | No stable one-to-one public replacement yet | Ink renderer work exists in-repo, but not as a documented stable public import path today.                         |

## Before-and-after examples

### Stream processor

#### Before

```ts
import { LLMStreamProcessor } from '@selfagency/llm-stream-parser/processor';

const processor = new LLMStreamProcessor({
  parseThinkTags: true,
  knownTools: new Set(['search', 'edit_file']),
});
```

#### After

```ts
import { LLMStreamProcessor } from '@agentsy/processor';

const processor = new LLMStreamProcessor({
  parseThinkTags: true,
  knownTools: new Set(['search', 'edit_file']),
});
```

### Pipeline transforms

#### Before

```ts
import { createSmoothStream, createThinkingFilter } from '@selfagency/llm-stream-parser/pipeline';
```

#### After

```ts
import { createSmoothStream, createThinkingFilter } from '@agentsy/processor';
```

### Tool calls plus structured output

#### Before

```ts
import { extractXmlToolCalls } from '@selfagency/llm-stream-parser/tool-calls';
import { parseJson } from '@selfagency/llm-stream-parser/structured';
```

#### After

```ts
import { extractXmlToolCalls } from '@agentsy/tool-calls';
import { parseJson } from '@agentsy/structured';
```

### Generic adapter usage

#### Before

```ts
import { createGenericAdapter } from '@selfagency/llm-stream-parser/adapters';
```

#### After

```ts
import { createGenericAdapter } from '@agentsy/adapters';
```

### Manual normalize + process loop → `processRawStream`

If your old monolith usage had custom loops that manually normalized chunks and fed a processor, prefer `processRawStream` in the new stack.

#### Before

```ts
for await (const rawChunk of providerStream) {
  const normalized = normalizeOpenAIChatChunk(rawChunk);
  if (!normalized) continue;
  const output = processor.process(normalized.chunk);
  render(output);
}
render(processor.flush());
```

#### After

```ts
import { processRawStream } from '@agentsy/adapters';
import { normalizeOpenAIChatChunk } from '@agentsy/normalizers';

for await (const output of processRawStream(providerStream, normalizeOpenAIChatChunk, { parseThinkTags: true })) {
  render(output);
}
```

### Manual parse + validate + conditional action → `runStructuredDecisionFromRawStream` + `applyDecisionAction`

If your monolith migration path still has repetitive "extract final content → validate schema → conditionally run side effect" code, move that orchestration to `@agentsy/adapters` helpers.

#### Before

```ts
for await (const rawChunk of providerStream) {
  const normalized = normalizeOpenAIChatChunk(rawChunk);
  if (!normalized) continue;
  processor.process(normalized.chunk);
}

const content = processor.accumulatedMessage.content;
const validated = validateJsonSchema(content, schema);
if (!validated.success) throw new Error(validated.errors.join('; '));

if (validated.data.shouldBlock) {
  await updateRemoteDns(validated.data);
}
```

#### After

```ts
import { applyDecisionAction, runStructuredDecisionFromRawStream } from '@agentsy/adapters';
import { normalizeOpenAIChatChunk } from '@agentsy/normalizers';

const decision = await runStructuredDecisionFromRawStream<unknown, { shouldBlock: boolean }>({
  source: providerStream,
  normalize: normalizeOpenAIChatChunk,
  schema,
});

if (!decision.success) {
  throw new Error(decision.errors.join('; '));
}

await applyDecisionAction(decision.decision, {
  shouldAct: value => value.shouldBlock,
  action: async value => updateRemoteDns(value),
});
```

### UI state

#### Before

```ts
import { createConversationStoreFromProcessor } from '@selfagency/llm-stream-parser/ui';
```

#### After

```ts
import { createConversationStoreFromProcessor } from '@agentsy/ui';
```

### VS Code renderer

#### Before

```ts
import { createVSCodeChatRenderer } from '@selfagency/llm-stream-parser/renderers/vscode';
```

#### After

```ts
import { createVSCodeChatRenderer } from '@agentsy/vscode';
```

## Conceptual migration notes

### The old monolith became a layered package family

In `v0.3.1`, one package carried most of the framework surface.

Today the same capabilities are split across focused layers:

- **Parsing primitives:** `@agentsy/thinking`, `@agentsy/xml-filter`, `@agentsy/context`, `@agentsy/tool-calls`, `@agentsy/structured`
- **Provider normalization:** `@agentsy/normalizers`
- **Stream orchestration:** `@agentsy/processor`
- **High-level orchestration:** `@agentsy/orchestrator/agent`, `@agentsy/adapters`, `@agentsy/ui`
- **Targeted integration layer:** `@agentsy/vscode`

### Not every old public subpath has a modern stable twin yet

The old package exposed several renderer-specific subpaths directly. In the current repo, renderer work is more modular, but the **publicly documented, exported** surface is narrower.

If you depended on:

- `renderers/plain` → migrate now to `@agentsy/renderers`
- `renderers/vscode` → migrate now to `@agentsy/vscode`
- `renderers/cli`, `renderers/streaming-md`, or `renderers/ink` → evaluate current repo state carefully before migrating; these should be treated as non-drop-in until they are fully documented and exported as stable public entry points

### The safest migration path today

If you are migrating production code **today**, the safest path is usually one of these:

1. **VS Code extension / chat provider work** → move to `@agentsy/vscode`
2. **Parser-only use** → move to the focused parsing packages you actually use
3. **Broader framework usage** → migrate incrementally, feature by feature, rather than swapping the entire monolith for every package in one heroic and probably unnecessary move

## Suggested migration checklist

- Replace the old package install with the smallest modern package set you need.
- Rewrite imports using the mapping table above.
- Check whether you relied on old renderer subpaths that do not yet have stable public replacements.
- Update examples and internal docs to point to `@agentsy/*` packages.
- If your codebase still mentions `@selfagency/llm-stream-parser`, link teammates to this guide.

## Related docs

- [Getting started](/getting-started)
- [API index](/api)
- [Package inventory](/packages)
- [Developer guide](/developers/)
