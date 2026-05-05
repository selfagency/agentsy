# @agentsy/context

Context-block extraction and deduplication utilities.

## Purpose

`@agentsy/context` provides helpers for splitting, stripping, and deduplicating XML context blocks.

## Role in Agentsy

Used by parsing and orchestration layers to keep injected context clean and stable across retries/continuations.

## Status

- Internal/pre-release package in this monorepo.

## Usage

```ts
import { splitLeadingXmlContextBlocks, dedupeXmlContextBlocksByTag, stripXmlContextTags } from '@agentsy/context';

const { contextBlocks, remaining } = splitLeadingXmlContextBlocks(input);
const deduped = dedupeXmlContextBlocksByTag(contextBlocks);
const plain = stripXmlContextTags(remaining);
```

## Development

```bash
cd packages/context
pnpm build
pnpm check-types
pnpm test
```
