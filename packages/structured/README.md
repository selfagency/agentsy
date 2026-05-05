# @agentsy/structured

Structured-output parsing, validation, and repair helpers.

## Purpose

`@agentsy/structured` provides JSON parsing, schema validation, and repair-oriented utilities for imperfect model responses.

## Role in Agentsy

Used in parsing pipelines where model output must be converted into reliable typed objects before downstream execution.

## Status

- Published `@agentsy` package.

## When to install it

Install this package when model output must become reliable typed data before downstream logic runs.

Typical neighbors:

- `@agentsy/processor`
- `@agentsy/tool-calls`
- `@agentsy/agent`

## API overview

- `parseJson`
- `validateJsonSchema`
- `buildFormatInstructions`
- `buildRepairPrompt`
- `streamJson`
- `autoRepair`
- `providerFormats`
- `repairStateMachine`
- `fieldValidator`
- `zodAdapter`

## Usage

```ts
import { parseJson, validateJsonSchema, buildRepairPrompt } from '@agentsy/structured';

const parsed = parseJson(text);
const result = validateJsonSchema(parsed, schema);
```

## Learn more

- [Package page](../../docs/packages/structured.md)

## Development

```bash
cd packages/structured
pnpm build
pnpm check-types
pnpm test
```
