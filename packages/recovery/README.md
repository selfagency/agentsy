# @agentsy/recovery

Stream snapshot and continuation prompt helpers.

## Purpose

`@agentsy/recovery` captures stream state and builds continuation prompts for interrupted model responses.

## Role in Agentsy

Used by resilience and long-running agent workflows to recover from partial output or transport interruption.

## Status

- Internal/pre-release package in this monorepo.

## Usage

```ts
import { captureStreamState, buildContinuationPrompt } from '@agentsy/recovery';

const snapshot = captureStreamState({ content, thinking, toolCalls });
const prompt = buildContinuationPrompt(snapshot);
```

## Development

```bash
cd packages/recovery
pnpm build
pnpm check-types
pnpm test
```
