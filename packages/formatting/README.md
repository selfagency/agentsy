# @agentsy/formatting

Formatting helpers for model output display.

## Purpose

`@agentsy/formatting` contains focused text-formatting helpers for display surfaces and post-processing output.

## Role in Agentsy

Used by renderers and integration layers to keep output readable and consistent.

## Status

- Internal/pre-release package in this monorepo.

## Usage

```ts
import {
  appendToBlockquote,
  formatXmlLikeResponseForDisplay,
  sanitizeNonStreamingModelOutput,
} from '@agentsy/formatting';
```

## Development

```bash
cd packages/formatting
pnpm build
pnpm check-types
pnpm test
```
