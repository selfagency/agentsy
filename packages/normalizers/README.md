# @agentsy/normalizers

Provider-specific stream normalization adapters.

## Purpose

`@agentsy/normalizers` converts provider-native payloads into a consistent stream chunk shape.

## Role in Agentsy

This package sits between raw provider responses and `@agentsy/processor` so downstream logic can stay provider-agnostic.

## Status

- Internal/pre-release package in this monorepo.

## Usage

```ts
import { normalizeOpenAIChatChunk, normalizeAnthropicEvent } from '@agentsy/normalizers';

const chunk = normalizeOpenAIChatChunk(raw);
```

## Development

```bash
cd packages/normalizers
pnpm build
pnpm check-types
pnpm test
```
