# @agentsy/thinking

Streaming reasoning-tag extraction utilities.

## Purpose

`@agentsy/thinking` extracts `<think>`-style reasoning content from streaming output while preserving normal assistant text.

## Role in Agentsy

Used directly by `@agentsy/processor` and available as a standalone parser for custom pipelines.

## Status

- Internal/pre-release package in this monorepo.

## Usage

```ts
import { ThinkingParser } from '@agentsy/thinking';

const parser = new ThinkingParser();
const [thinking, content] = parser.addContent(chunk);
const [finalThinking, finalContent] = parser.flush();
```

## Development

```bash
cd packages/thinking
pnpm build
pnpm check-types
pnpm test
```
