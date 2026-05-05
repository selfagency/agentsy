# @agentsy/recovery

Stream snapshot and continuation prompt helpers.

## Purpose

`@agentsy/recovery` captures stream state and builds continuation prompts for interrupted model responses.

## Role in Agentsy

Used by resilience and long-running agent workflows to recover from partial output or transport interruption.

## Status

- Published `@agentsy` package.

## When to install it

Install this package when you need to resume interrupted model responses or persist enough processor state to continue later.

Typical neighbors:

- `@agentsy/processor`
- `@agentsy/agent`

## API overview

- `captureStreamState`
- `buildContinuationPrompt`

## Usage

```ts
import { LLMStreamProcessor } from '@agentsy/processor';
import { captureStreamState, buildContinuationPrompt } from '@agentsy/recovery';

const processor = new LLMStreamProcessor();
const snapshot = captureStreamState(processor);
const prompt = buildContinuationPrompt(snapshot);
```

## Learn more

- [Package page](https://agentsy.self.agency/packages/recovery)

## Development

```bash
cd packages/recovery
pnpm build
pnpm check-types
pnpm test
```
