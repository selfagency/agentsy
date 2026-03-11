# Welcome to llm-stream-parser

Composable parsers and stream processing utilities for LLM responses.

## Overview

`llm-stream-parser` provides production-ready parsing utilities for handling LLM output streams with support for:

- **Thinking extraction** - Extract and process reasoning sections (e.g., `<think>...</think>`)
- **XML filtering** - Context block deduplication and filtering
- **Tool-call extraction** - Parse and validate structured tool invocations
- **Structured output** - JSON parsing with schema validation and repair
- **Stream processing** - Flexible processor for orchestrating multiple parsers
- **Adapters** - Generic and specialized adapters for different integration patterns

## Quick Start

### Installation

```bash
npm install llm-stream-parser
pnpm add llm-stream-parser
yarn add llm-stream-parser
```

### Basic Usage

```typescript
import { parseJson, extractXmlToolCalls } from 'llm-stream-parser';

// Parse JSON from streaming LLM output
const result = parseJson(streamData);

// Extract tool calls from XML format
const toolCalls = extractXmlToolCalls(response, new Set(['send_message', 'search']));
```

## Features

- **Streaming-friendly** - Designed for chunk-by-chunk processing
- **Composable** - Mix and match parsers with the pipe operator
- **Type-safe** - Full TypeScript support
- **Limit enforcement** - Built-in safety rails for JSON depth, key counts, and tool calls
- **Privacy-aware** - Configurable privacy scrubbing for sensitive context blocks

## Use Cases

- **Agent frameworks** - Process Claude or other LLM outputs in agents
- **RAG systems** - Parse structured output from retrieval-augmented generation
- **Tool use** - Extract and validate tool calls from model responses
- **Real-time applications** - Stream processing without buffering entire responses

## Documentation

- [Getting Started](/getting-started) - Setup and basic examples
- [API Reference](/api) - Complete API documentation
- [Developer Guide](/developers/) - Local development and contribution guide
- [Integration Examples](/developers/integration-copilot) - Integration patterns

## License

MIT
