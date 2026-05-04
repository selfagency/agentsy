# @agentsy/sse

Server-Sent Events parsing utilities.

## Purpose

`@agentsy/sse` provides low-level SSE parsing primitives used to consume chunked model responses from provider APIs.

## Role in Agentsy

This package feeds normalized stream fragments into higher-level packages like `@agentsy/processor`.

## Status

- Internal/pre-release package in this monorepo.

## Usage

```ts
import { SSEParser, parseSSEStream } from '@agentsy/sse';

const parser = new SSEParser();
for await (const event of parseSSEStream(stream)) {
  // handle parsed SSE event
}
```

## Development

```bash
cd packages/sse
pnpm build
pnpm check-types
pnpm test
```
