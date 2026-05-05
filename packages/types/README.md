# @agentsy/types

Shared type contracts for the Agentsy framework.

## Purpose

`@agentsy/types` defines the common TypeScript types used across stream parsing, tool calls, usage accounting, and conversation events.

## Role in Agentsy

This package is the foundation for type-level compatibility between `normalizers`, `processor`, `agent`, `renderers`, and `vscode`.

## Status

- Published `@agentsy` package.

## When to install it

Install this package when you want shared type contracts without pulling in implementation-heavy runtime packages.

## API overview

- conversation types
- stream event types
- tool-call types
- usage types
- JSON helper types re-exported from `type-fest`

## Usage

```ts
import type { StreamChunk, FinishReason, UsageInfo } from '@agentsy/types';
```

## Learn more

- `/docs/packages/types.md`

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
