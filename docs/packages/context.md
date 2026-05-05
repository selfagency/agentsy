# `@agentsy/context`

- **Status:** Published
- **Role:** Context splitting, stripping, and dedupe helpers

## Where it fits

Use `@agentsy/context` when you need lightweight utilities for shaping prompt or conversation context before it flows into a processor or runtime.

## Current surface

- `splitLeadingXmlContextBlocks`
- `dedupeXmlContextBlocksByTag`
- `stripXmlContextTags`

## Available APIs

- XML context splitting
- XML context dedupe
- XML context tag stripping

## Common neighbors

- `@agentsy/structured`
- `@agentsy/agent`
- `@agentsy/vscode`

## Implementation example with neighbors

```ts
import { dedupeXmlContextBlocksByTag, splitLeadingXmlContextBlocks, stripXmlContextTags } from '@agentsy/context';

const { contextBlocks, remaining } = splitLeadingXmlContextBlocks(modelOutput);
const mergedContext = dedupeXmlContextBlocksByTag([existingContext, ...contextBlocks].filter(Boolean));
const cleanBody = stripXmlContextTags(remaining);

console.log({ mergedContext, cleanBody });
```
