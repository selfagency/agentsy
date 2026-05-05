# @agentsy/xml-filter

XML stream filtering and privacy scrubbing helpers.

## Purpose

`@agentsy/xml-filter` strips or preserves configured XML tags from streaming output and enforces privacy-safe defaults.

## Role in Agentsy

This package is used in stream-processing paths where XML-like wrappers appear in model output and sensitive content must be scrubbed before rendering.

## Status

- Internal/pre-release package in this monorepo.

## Usage

```ts
import { createXmlStreamFilter } from '@agentsy/xml-filter';

const filter = createXmlStreamFilter({ enforcePrivacyTags: true });
const visible = filter.write(chunk);
const remaining = filter.end();
```

## Development

```bash
cd packages/xml-filter
pnpm build
pnpm check-types
pnpm test
```
