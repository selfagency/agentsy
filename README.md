# @selfagency/llm-stream-parser

Composable parsers and stream processing utilities for LLM responses.

[![npm](https://img.shields.io/npm/v/@selfagency/llm-stream-parser)](https://www.npmjs.com/package/@selfagency/llm-stream-parser)
[![CI](https://github.com/selfagency/llm-stream-parser/actions/workflows/tests.yml/badge.svg)](https://github.com/selfagency/selfagency/actions/workflows/tests.yml)
[![codecov](https://codecov.io/gh/selfagency/llm-stream-parser/graph/badge.svg?token=4U6b4yU5Ln)](https://codecov.io/gh/selfagency/llm-stream-parser)
[![Codacy Badge](https://app.codacy.com/project/badge/Grade/be00077d20c54f9097c7f38bf575603f)](https://app.codacy.com/gh/selfagency/llm-stream-parser/dashboard?utm_source=gh&utm_medium=referral&utm_content=&utm_campaign=Badge_grade)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Features

- 🧠 **Thinking extraction** — Parse and separate `<think>` reasoning sections from visible output, chunk-by-chunk
- 🧼 **XML stream filtering** — Scrub context blocks and privacy tags from streaming output
- 🛠️ **Tool-call extraction** — Extract and validate structured XML and native tool invocations
- 🏛️ **Structured output** — JSON parsing with schema validation, depth/key limits, and auto-repair
- 🤖 **Agent loops** — Multi-step LLM execution with configurable stop conditions and tool handling
- 🚰 **Stream processor** — Event-driven orchestrator that composes all parsers in a single pipeline
- 🔌 **Normalizers** — Adapters for OpenAI, Anthropic, Gemini, Mistral, Cohere, Ollama, AWS Bedrock, and HF TGI
- 💻 **VS Code integration** — ChatResponseStream renderers with thinking progress, tool feedback, and cancellation support
- 👮‍♂️ **Safety by default** — Privacy tags are always scrubbed; JSON depth, key counts, and tool-call sizes are bounded

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
  processor.process({
    content: chunk.content,
    done: chunk.done,
    stepIndex: chunk.stepIndex, // optional, useful for multi-step agent loops
    stepUsage: chunk.stepUsage, // optional per-step token usage
  });
}
```

`StreamChunk` and `ProcessedOutput` both support optional `stepIndex` and `stepUsage` fields so higher-level agent loops can preserve step-local metadata without custom wrappers.

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
const parser = ThinkingParser.forModel('deepseek'); // <think></think>
const parser = ThinkingParser.forModel('granite'); // <|thinking|></|thinking|>
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
  {
    name: 'search',
    description: 'Search the web',
    inputSchema: { properties: { query: { type: 'string' } }, required: ['query'] },
  },
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

Additional utilities: `buildFormatInstructions`, `buildRepairPrompt`, `streamJson`, `zodToJsonSchema`, `validateWithZod`, `repairWithLLM`, `pipe`, `buildNativeToolsArray`.

---

### `@selfagency/llm-stream-parser/agent` — Multi-step agent loops

Execute multi-step reasoning loops with automatic tool handling and configurable stopping conditions.

```typescript
import { createAgentLoop } from '@selfagency/llm-stream-parser/agent';

const agent = createAgentLoop({
  // Call your LLM with current message history
  execute: async function* (messages) {
    const response = await fetch('https://api.example.com/chat', {
      method: 'POST',
      body: JSON.stringify({ messages }),
    });

    for await (const chunk of response.body) {
      yield { content: chunk.toString(), done: false };
    }
  },

  // Stop when thinking is detected (or return false to continue)
  stopWhen: state => state.lastOutput.thinking.length > 0,

  // Build tool results to append to conversation
  buildToolResultMessages: async toolCalls => {
    const results = await Promise.all(
      toolCalls.map(async call => ({
        role: 'user',
        content: `Tool "${call.name}" executed with result: ${JSON.stringify(result)}`,
      })),
    );
    return results;
  },

  // Optional: Called after each step
  onStep: async result => {
    console.log(`Step ${result.output.done ? 'done' : 'in progress'}`);
  },
});

// Run the loop
for await (const part of agent.run([{ role: 'user', content: 'Solve this...' }])) {
  if (part.type === 'text') console.log(part.text);
  if (part.type === 'tool_call') await executeTool(part.call);
}
```

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

### `@selfagency/llm-stream-parser/ui` — Event-sourced conversation state

```typescript
import { LLMStreamProcessor } from '@selfagency/llm-stream-parser/processor';
import { createConversationStoreFromProcessor } from '@selfagency/llm-stream-parser/ui';

const processor = new LLMStreamProcessor({ scrubContextTags: false });
const bridge = createConversationStoreFromProcessor(processor, {
  conversationId: 'conv-1',
});

processor.process({ stepIndex: 0, thinking: 'plan' });
processor.process({ content: 'Hello', done: true, finishReason: 'stop' });

console.log(bridge.store.getState().messages);
bridge.dispose();
```

The UI package can now consume reducer-friendly processor events automatically, including step lifecycle markers, streaming tool-call updates, and final message usage.

---

### `@selfagency/llm-stream-parser/pipeline` — Output transforms

```typescript
import { createSmoothStream, createThinkingFilter } from '@selfagency/llm-stream-parser/pipeline';

const processor = new LLMStreamProcessor({
  transforms: [
    createThinkingFilter(),
    createSmoothStream({ chunkSize: 4, delayMs: 25 }),
  ],
});
```

`createSmoothStream()` splits large text bursts into smaller parts and can optionally pause between sub-chunks with `delayMs` for steadier UI output.

---

### `@selfagency/llm-stream-parser/formatting` — Output sanitization

```typescript
import {
  sanitizeNonStreamingModelOutput,
  formatXmlLikeResponseForDisplay,
} from '@selfagency/llm-stream-parser/formatting';
```

---

### `@selfagency/llm-stream-parser/markdown` — Markdown utilities

```typescript
import { appendToBlockquote } from '@selfagency/llm-stream-parser/markdown';
```

---

## Renderers

**Renderers** stream LLM response content to specific output targets (plain text, formatted terminal, browser DOM, VS Code chat). Each renderer owns an internal `LLMStreamProcessor` and handles thinking blocks, tool calls, step changes, and error callbacks.

All renderers use a factory pattern and implement the same `{ write(chunk), writeChunk(streamChunk), end() }` interface:

```typescript
import { createPlainTextRenderer } from '@selfagency/llm-stream-parser/renderers/plain';

const renderer = createPlainTextRenderer({
  showThinking: true,
  onError: err => logger.error(err),
  onStep: async (stepIndex, usage) => {
    logger.info(`entered step ${stepIndex}`, usage);
  },
});

await renderer.write('# Response\n');
await renderer.write('Content here');
await renderer.writeChunk({ content: 'Structured content', stepIndex: 1, done: false });
await renderer.end();
```

### Plain Text Renderer

Zero-dependency renderer for CLI/logging. Prefix-based thinking blocks.

```typescript
import { createPlainTextRenderer } from '@selfagency/llm-stream-parser/renderers/plain';

const renderer = createPlainTextRenderer({
  showThinking: true,
  thinkingPrefix: '[💭] ', // customize thinking block prefix
  output: text => process.stdout.write(text), // optional; defaults to process.stdout
});

await renderer.write(chunk);
await renderer.end();
```

**Thinking Style**: `prefix` (default: `[Thinking]`). Configure with `thinkingPrefix` option.

---

### CLI Markdown Renderer

Terminal-formatted markdown with blockquote thinking blocks.
**Requires peer dependency**: `npm install cli-markdown`

```typescript
import { createCliRenderer } from '@selfagency/llm-stream-parser/renderers/cli';

const renderer = createCliRenderer({
  showThinking: true,
  thinkingStyle: 'blockquote', // or 'suppress'
  output: text => process.stdout.write(text),
});

await renderer.write(chunk);
await renderer.end();
```

**Thinking Styles:**

- `blockquote` (default): Render thinking as `> **💭 Thinking:** ...` markdown blockquote
- `suppress`: Hide thinking blocks entirely

---

### Streaming Markdown Renderer

Browser-based DOM rendering with incremental updates and security sanitization.
**Requires peer dependencies**: `npm install streaming-markdown dompurify`

```typescript
import { createStreamingMarkdownRenderer } from '@selfagency/llm-stream-parser/renderers/streaming-md';

const target = document.getElementById('response');
const renderer = createStreamingMarkdownRenderer({
  target,
  showThinking: true,
  thinkingContainer: document.getElementById('thinking'), // optional separate container
  onSecurityViolation: () => console.warn('XSS attempt blocked'),
});

await renderer.write(chunk);
await renderer.end();
```

**Thinking Style**: `blockquote` (default) or `inline`. Separate container if provided.

---

### VS Code Chat Renderer

Integration with VS Code's `ChatResponseStream` for Copilot extensions. Stream LLM responses directly to VS Code's Chat interface with built-in support for thinking blocks, tool invocations, and token usage.
**No external dependencies required.**

**Features:**

- Automatic thinking block rendering (blockquote or progress indicator)
- Tool invocation callbacks for real-time feedback
- Token usage reporting
- CancellationToken support via `cancellationTokenToAbortSignal()`

```typescript
import { createVSCodeChatRenderer } from '@selfagency/llm-stream-parser/renderers/vscode';

const renderer = createVSCodeChatRenderer({
  stream, // VS Code ChatResponseStream
  showThinking: true,
  thinkingStyle: 'blockquote', // 'blockquote' | 'progress' | 'suppress'
});

// Stream chunks from your LLM
for await (const chunk of llmStream) {
  await renderer.writeChunk(chunk);
}

await renderer.end();
```

**For agent loops:**

```typescript
import { createVSCodeAgentLoop } from '@selfagency/llm-stream-parser/renderers/vscode';

const renderer = createVSCodeAgentLoop({
  stream,
  thinkingStyle: 'blockquote', // Thinking enabled by default for agent reasoning
});
```

**Thinking Styles:**

- `blockquote` (default): Render as `> **💭 Thinking:** ...` markdown
- `progress`: Send thinking via `stream.progress()` for VS Code progress indicator

Tool calls fire the `onToolCall` callback but are not rendered as content.

When a renderer receives structured chunks via `writeChunk()`, it can also call `onStep(stepIndex, usage)` as step metadata changes.

---

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

MIT ©2026 [The Self Agency, LLC](https://self.agency)
