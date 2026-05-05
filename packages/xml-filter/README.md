# @agentsy/xml-filter

XML stream filtering and privacy scrubbing helpers.

## Purpose

`@agentsy/xml-filter` strips or preserves configured XML tags from streaming output and enforces privacy-safe defaults.

## Role in Agentsy

This package is used in stream-processing paths where XML-like wrappers appear in model output and sensitive content must be scrubbed before rendering.

## Status

- Published `@agentsy` package.

## When to install it

Install this package when your model output mixes user-visible content with XML-like control or privacy tags that should be scrubbed incrementally.

Typical neighbors:

- `@agentsy/context`
- `@agentsy/processor`
- `@agentsy/formatting`

## API overview

- `createXmlStreamFilter`
- `XmlStreamFilter`
- `tagLists`

## Usage

```ts
import { createXmlStreamFilter } from '@agentsy/xml-filter';

const filter = createXmlStreamFilter({ enforcePrivacyTags: true });
const visible = filter.write(chunk);
const remaining = filter.end();
```

## Learn more

- `/docs/packages/xml-filter.md`

## Development

```bash
cd packages/xml-filter
pnpm build
pnpm check-types
pnpm test
```
