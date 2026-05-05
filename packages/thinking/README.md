# @agentsy/thinking

Streaming reasoning-tag extraction utilities.

## Purpose

`@agentsy/thinking` extracts `<think>`-style reasoning content from streaming output while preserving normal assistant text.

## Role in Agentsy

Used directly by `@agentsy/processor` and available as a standalone parser for custom pipelines.

## Status

- Published `@agentsy` package.

## When to install it

Install this package when you need focused reasoning-tag parsing without pulling in the full processing stack.

Typical neighbors:

- `@agentsy/processor`
- `@agentsy/formatting`
- `@agentsy/renderers`

## API overview

- `ThinkingParser`

## Usage

```ts
import { ThinkingParser } from '@agentsy/thinking';

const parser = new ThinkingParser();
const [thinking, content] = parser.addContent(chunk);
const [finalThinking, finalContent] = parser.flush();
```

## Learn more

- `/docs/packages/thinking.md`

## Development

```bash
cd packages/thinking
pnpm build
pnpm check-types
pnpm test
```
