# @agentsy/types

Shared type contracts for the Agentsy framework.

## Purpose

`@agentsy/types` defines the common TypeScript types used across stream parsing, tool calls, usage accounting, and conversation events.

## Role in Agentsy

This package is the foundation for type-level compatibility between `normalizers`, `processor`, `agent`, `renderers`, and `vscode`.

## Status

- Internal/pre-release package in this monorepo.

## Usage

```ts
import type { StreamChunk, FinishReason, UsageInfo } from '@agentsy/types';
```

## Development

```bash
cd packages/types
pnpm build
pnpm check-types
pnpm test
```

From repo root:

```bash
pnpm check-types
pnpm test
```
