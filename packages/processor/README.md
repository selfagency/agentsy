# @agentsy/processor

Event-driven LLM stream orchestration engine.

## Purpose

`@agentsy/processor` accumulates and transforms stream chunks into meaningful output parts (text, thinking, tool calls, usage, finish state).

## Role in Agentsy

This is the central runtime parser/orchestrator package that composes `thinking`, `tool-calls`, `xml-filter`, and related utilities.

## Status

- Published `@agentsy` package.

## When to install it

Install this package when you need the central incremental processing layer beneath renderers, UI state, adapters, or agent loops.

Typical neighbors:

- `@agentsy/normalizers` upstream for provider compatibility
- `@agentsy/thinking`, `@agentsy/tool-calls`, and `@agentsy/structured` for specialized parsing concerns
- `@agentsy/ui`, `@agentsy/renderers`, `@agentsy/agent`, and `@agentsy/vscode` downstream

## API overview

- `LLMStreamProcessor`
- `createProcessorEventAdapter`
- `ToolCallParser`
- `ZAiInlineToolCallParser`
- `createPipeline`
- `createSmoothStream`
- `createThinkingFilter`
- `createToolCallFilter`

## Usage

```ts
import { normalizeOpenAIChatChunk } from '@agentsy/normalizers';
import { LLMStreamProcessor } from '@agentsy/processor';

const processor = new LLMStreamProcessor({ parseThinkTags: true });
for await (const rawChunk of openAiStream) {
  const normalized = normalizeOpenAIChatChunk(rawChunk);
  processor.process(normalized);
}

const final = processor.flush();
console.log(final.content);
```

## Learn more

- `/docs/packages/processor.md`
- `/docs/architecture/stream-processing.md`

## Development

```bash
cd packages/processor
pnpm build
pnpm check-types
pnpm test
```
