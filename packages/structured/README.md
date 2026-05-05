# @agentsy/structured

Structured-output parsing, validation, and repair helpers.

## Purpose

`@agentsy/structured` provides JSON parsing, schema validation, and repair-oriented utilities for imperfect model responses.

## Role in Agentsy

Used in parsing pipelines where model output must be converted into reliable typed objects before downstream execution.

## Status

- Internal/pre-release package in this monorepo.

## Usage

```ts
import { parseJson, validateJsonSchema, buildRepairPrompt } from '@agentsy/structured';

const parsed = parseJson(text);
const result = validateJsonSchema(JSON.stringify(parsed), schema);
```

## Development

```bash
cd packages/structured
pnpm build
pnpm check-types
pnpm test
```
