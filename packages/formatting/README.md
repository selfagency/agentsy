# @agentsy/formatting

Formatting helpers for model output display.

## Purpose

`@agentsy/formatting` contains focused text-formatting helpers for display surfaces and post-processing output.

## Role in Agentsy

Used by renderers and integration layers to keep output readable and consistent.

## Status

- Published `@agentsy` package.

## When to install it

Install this package when you need focused post-processing helpers for display-ready model output.

Typical neighbors:

- `@agentsy/renderers`
- `@agentsy/ui`
- `@agentsy/vscode`

## API overview

- `appendToBlockquote`
- `formatXmlLikeResponseForDisplay`
- `sanitizeNonStreamingModelOutput`

## Usage

```ts
import {
  appendToBlockquote,
  formatXmlLikeResponseForDisplay,
  sanitizeNonStreamingModelOutput,
} from '@agentsy/formatting';
```

## Learn more

- [Package page](../../docs/packages/formatting.md)

## Development

```bash
cd packages/formatting
pnpm build
pnpm check-types
pnpm test
```
