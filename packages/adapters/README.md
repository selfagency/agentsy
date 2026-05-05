# @agentsy/adapters

Adapter helpers for model/provider integration boundaries.

## Purpose

`@agentsy/adapters` contains adapter utilities for integrating stream pipelines with provider-specific invocation surfaces.

## Role in Agentsy

Used as a bridge layer between provider I/O and normalized processing flow.

## Status

- Internal/pre-release package in this monorepo.

## Usage

```ts
import { processStream } from '@agentsy/adapters';

const parts = await processStream(source, options);
```

## Development

```bash
cd packages/adapters
pnpm build
pnpm check-types
pnpm test
```
