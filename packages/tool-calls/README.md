# @agentsy/tool-calls

Tool-call extraction, accumulation, and prompt helpers.

## Purpose

`@agentsy/tool-calls` parses tool calls from XML/native formats and provides accumulation utilities for streamed tool deltas.

## Role in Agentsy

This package bridges model output and tool execution orchestration in `@agentsy/processor` and `@agentsy/agent` flows.

## Status

- Published `@agentsy` package.

## When to install it

Install this package when your workflow needs to extract, accumulate, or answer tool calls from streamed model output.

Typical neighbors:

- `@agentsy/processor`
- `@agentsy/structured`
- `@agentsy/agent`

## API overview

- `extractXmlToolCalls`
- `ToolCallAccumulator`
- `buildNativeToolsPayload`
- `buildToolResultMessage`
- `buildXmlToolSystemPrompt`

## Usage

```ts
import { extractXmlToolCalls, ToolCallAccumulator, buildXmlToolSystemPrompt } from '@agentsy/tool-calls';

const calls = extractXmlToolCalls(output, knownTools);
```

## Learn more

- [Package page](../../docs/packages/tool-calls.md)

## Development

```bash
cd packages/tool-calls
pnpm build
pnpm check-types
pnpm test
```
