# @agentsy/context

Context-block extraction and deduplication utilities.

## Purpose

`@agentsy/context` provides helpers for splitting, stripping, and deduplicating XML context blocks.

## Role in Agentsy

Used by parsing and orchestration layers to keep injected context clean and stable across retries/continuations.

## Status

- Published `@agentsy` package.

## When to install it

Install this package when you need to split, dedupe, or strip XML context blocks before continuing through the pipeline.

Typical neighbors:

- `@agentsy/xml-filter`
- `@agentsy/structured`
- `@agentsy/agent`

## API overview

- `splitLeadingXmlContextBlocks`
- `dedupeXmlContextBlocksByTag`
- `stripXmlContextTags`

## Usage

```ts
import { splitLeadingXmlContextBlocks, dedupeXmlContextBlocksByTag, stripXmlContextTags } from '@agentsy/context';

const { contextBlocks, remaining } = splitLeadingXmlContextBlocks(input);
const deduped = dedupeXmlContextBlocksByTag(contextBlocks);
const plain = stripXmlContextTags(remaining);
```

## Learn more

- [Package page](../../docs/packages/context.md)

## Development

```bash
cd packages/context
pnpm build
pnpm check-types
pnpm test
```
