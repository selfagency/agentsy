# @selfagency/llm-stream-parser

Composable parsers and stream processing utilities for LLM responses.

[![npm](https://img.shields.io/npm/v/@selfagency/llm-stream-parser)](https://www.npmjs.com/package/@selfagency/llm-stream-parser)
[![CI](https://github.com/selfagency/@selfagency/llm-stream-parser/actions/workflows/tests.yml/badge.svg)](https://github.com/selfagency/@selfagency/llm-stream-parser/actions/workflows/tests.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Features

- **Thinking extraction** — Parse and separate `<think>` reasoning sections from visible output, chunk-by-chunk
- **XML stream filtering** — Scrub context blocks and privacy tags from streaming output
- **Tool-call extraction** — Extract and validate structured XML tool invocations
- **Structured output** — JSON parsing with schema validation, depth/key limits, and auto-repair
- **Stream processor** — Event-driven orchestrator that composes all parsers in a single pipeline
- **Normalizers** — Adapters for OpenAI, Anthropic, Gemini, Mistral, Cohere, Ollama, AWS Bedrock, and HF TGI
- **Safety by default** — Privacy tags are always scrubbed; JSON depth, key counts, and tool-call sizes are bounded

## Installation

```bash
npm install @selfagency/llm-stream-parser
# or
pnpm add @selfagency/llm-stream-parser
# or
yarn add @selfagency/llm-stream-parser
```

**Requirements**: Node.js 18+, TypeScript 5.0+ (if using TypeScript)

## Quick Start

```typescript
import { LLMStreamProcessor } from '@selfagency/llm-stream-parser/processor';

const processor = new LLMStreamProcessor({
  parseThinkTags: true,
  knownTools: new Set(['search', 'edit_file']),
});

processor.on('thinking', delta => process.stdout.write(`[thinking] ${delta}`));
processor.on('text', delta => process.stdout.write(delta));
processor.on('tool_call', call => executeToolCall(call));

for await (const chunk of apiStream) {
  processor.process({ content: chunk.content, done: chunk.done });
}
```

## Modules

### `@selfagency/llm-stream-parser/thinking` — ThinkingParser

Chunk-by-chunk extraction of `<think>` blocks. Returns `[thinkingContent, regularContent]` on every call.

```typescript
import { ThinkingParser } from '@selfagency/llm-stream-parser/thinking';

const parser = new ThinkingParser();

for await (const chunk of llmStream) {
  const [thinking, content] = parser.addContent(chunk);
  if (thinking) showReasoning(thinking);
  if (content) showOutput(content);
}

const [finalThinking, finalContent] = parser.flush();
```

Automatic tag detection for common models:

```typescript
const parser = ThinkingParser.forModel('deepseek');   // <think></think>
const parser = ThinkingParser.forModel('granite');    // <|thinking|></|thinking|>
```

---

### `@selfagency/llm-stream-parser/xml-filter` — XmlStreamFilter

Stream-safe scrubbing of XML context and privacy blocks.

```typescript
import { createXmlStreamFilter } from '@selfagency/llm-stream-parser/xml-filter';

const filter = createXmlStreamFilter({ enforcePrivacyTags: true });

for await (const chunk of llmStream) {
  output.write(filter.write(chunk));
}
output.write(filter.end());
```

Privacy tags are enforced by default (`enforcePrivacyTags: true`). Pass `enforcePrivacyTags: false` to opt out explicitly.

---

### `@selfagency/llm-stream-parser/context` — Context splitting & dedup

```typescript
import {
  splitLeadingXmlContextBlocks,
  dedupeXmlContextBlocksByTag,
  stripXmlContextTags,
} from '@selfagency/llm-stream-parser/context';

const { contextBlocks, remaining } = splitLeadingXmlContextBlocks(response);
const unique = dedupeXmlContextBlocksByTag(contextBlocks);
const clean = stripXmlContextTags(remaining);
```

---

### `@selfagency/llm-stream-parser/tool-calls` — XML tool-call extraction

```typescript
import { extractXmlToolCalls, buildXmlToolSystemPrompt } from '@selfagency/llm-stream-parser/tool-calls';

// Extract tool calls from a response
const calls = extractXmlToolCalls(response, new Set(['search', 'edit_file']));
for (const call of calls) {
  await executeTool(call.name, call.parameters);
}

// Build the system prompt that teaches the model to emit tool calls
const systemPrompt = buildXmlToolSystemPrompt([
  { name: 'search', description: 'Search the web', inputSchema: { properties: { query: { type: 'string' } }, required: ['query'] } },
  { name: 'edit_file', description: 'Edit a file' },
]);
```

`buildXmlToolSystemPrompt` throws on invalid tool names; `extractXmlToolCalls` never throws and silently drops malformed calls.

---

### `@selfagency/llm-stream-parser/structured` — JSON parsing & validation

```typescript
import { parseJson, validateJsonSchema } from '@selfagency/llm-stream-parser/structured';

// Tolerant parse — returns null on failure, never throws
const data = parseJson(responseText, { maxJsonDepth: 10, maxJsonKeys: 100 });

// Schema validation — returns discriminated union
const result = validateJsonSchema(responseText, {
  type: 'object',
  properties: { name: { type: 'string' }, age: { type: 'integer' } },
  required: ['name'],
});

if (result.success) {
  console.log(result.data);
} else {
  console.error(result.errors);
}
```

Additional utilities: `buildFormatInstructions`, `buildRepairPrompt`, `streamJson`, `zodToJsonSchema`, `validateWithZod`, `repairWithLLM`, `pipe`.

---

### `@selfagency/llm-stream-parser/normalizers` — Provider normalizers

Normalize streaming events from different providers into a common `StreamChunk` shape:

```typescript
import { normalizeOpenAI } from '@selfagency/llm-stream-parser/normalizers';

for await (const event of openaiStream) {
  const { chunk } = normalizeOpenAI(event);
  if (chunk) processor.process(chunk);
}
```

Supported: `openai`, `openaiResponses`, `anthropic`, `gemini`, `mistral`, `cohere`, `ollama`, `bedrock`, `hfTgi`.

---

### `@selfagency/llm-stream-parser/adapters` — High-level adapters

```typescript
import { createGenericAdapter } from '@selfagency/llm-stream-parser/adapters';

const adapter = createGenericAdapter(
  {
    onContent: text => display(text),
    onThinking: text => displayReasoning(text),
    onToolCall: call => executeToolCall(call),
  },
  { parseThinkTags: true, scrubContextTags: true },
);

await adapter.write(chunk);
await adapter.end();
```

---

### `@selfagency/llm-stream-parser/formatting` — Output sanitization

```typescript
import { sanitizeNonStreamingModelOutput, formatXmlLikeResponseForDisplay } from '@selfagency/llm-stream-parser/formatting';
```

---

### `@selfagency/llm-stream-parser/markdown` — Markdown utilities

```typescript
import { appendToBlockquote } from '@selfagency/llm-stream-parser/markdown';
```

## Error Handling

| Category                                                                                     | Behaviour                                                                         |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Streaming / parsing (`parseJson`, `ThinkingParser`, `XmlStreamFilter`, `LLMStreamProcessor`) | **Never throw.** Return best-effort results; malformed input is silently skipped. |
| Configuration (`buildXmlToolSystemPrompt`)                                                   | **Throw** `Error` on invalid arguments (caught at setup time).                    |
| Validation (`validateJsonSchema`)                                                            | Return `{ success: true; data }` or `{ success: false; errors }` — never throw.   |

## Development

```bash
pnpm install
task check-types     # TypeScript type check
task unit-tests      # Run Vitest suite
task lint            # oxlint
task format          # oxfmt
task compile         # tsup → dist/
task precommit       # check-types + lint-fix + format
```

## Contributing

1. Fork and clone the repository
2. Create a branch: `feat/your-feature`, `fix/your-fix`, etc.
3. Make changes with colocated tests (`module.test.ts` next to source)
4. Run `task precommit` before pushing
5. Open a pull request

See [docs/developers/contributing.md](docs/developers/contributing.md) for full details.

## License

MIT © [Daniel Sieradski](https://self.agency)
