# @agentsy/processor

Event-driven LLM stream orchestration engine.

## Purpose

`@agentsy/processor` accumulates and transforms stream chunks into meaningful output parts (text, thinking, tool calls, usage, finish state).

## Role in Agentsy

This is the central runtime parser/orchestrator package that composes `thinking`, `tool-calls`, `xml-filter`, and related utilities.

## Status

- Internal/pre-release package in this monorepo.

## Usage

```ts
import { LLMStreamProcessor } from '@agentsy/processor';

const processor = new LLMStreamProcessor({ parseThinkTags: true });
const output = processor.process(chunk);
const final = processor.flush();
```

## Development

```bash
cd packages/processor
pnpm build
pnpm check-types
pnpm test
```
