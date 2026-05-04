# @agentsy/renderers

Composable output renderers for stream-driven UIs.

## Purpose

`@agentsy/renderers` provides plain-text, CLI, and Ink renderer building blocks for streamed assistant output.

## Role in Agentsy

This package sits downstream of `@agentsy/processor` and `@agentsy/agent` to present model output in terminal and programmatic UI surfaces.

## Status

- Internal/pre-release package in this monorepo.

## Usage

```ts
import { createPlainTextRenderer } from '@agentsy/renderers';

const renderer = createPlainTextRenderer();
renderer.writeChunk(chunk);
renderer.end();
```

## Development

```bash
cd packages/renderers
pnpm build
pnpm check-types
pnpm test
```
