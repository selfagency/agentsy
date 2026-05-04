# @agentsy/core

Foundation stream parsing layer for agent infrastructure. Thinking extraction, XML filtering, tool-call routing, JSON validation, provider normalization.

[![npm](https://img.shields.io/npm/v/@agentsy/core)](https://www.npmjs.com/package/@agentsy/core)
[![CI](https://github.com/agentsy/agentsy/actions/workflows/tests.yml/badge.svg)](https://github.com/agentsy/agentsy/actions/workflows/tests.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Features

- 🧠 **Thinking extraction** — Parse and separate `<think>` reasoning sections from visible output, chunk-by-chunk
- 🧼 **XML stream filtering** — Scrub context blocks and privacy tags from streaming output with deduplication
- 🛠️ **Tool-call extraction** — Extract and validate structured XML and native tool invocations
- 🏛️ **Structured output** — JSON parsing with schema validation, depth/key limits, and auto-repair
- 🤖 **Agent loops** — Multi-step LLM execution with configurable stop conditions and tool handling
- 🚰 **Stream processor** — Event-driven orchestrator that composes all parsers in a single pipeline
- 🔌 **Normalizers** — Adapters for OpenAI, Anthropic, Gemini, Mistral, Cohere, Ollama, AWS Bedrock, HF TGI, and Z.ai
- 👮‍♂️ **Safety by default** — Privacy tags are always scrubbed; JSON depth, key counts, and tool-call sizes are bounded
- ✨ **Zero dependencies** — Foundation layer has no runtime dependencies beyond Node.js built-ins

## Installation

```bash
npm install @agentsy/core
# or
pnpm add @agentsy/core
# or
yarn add @agentsy/core
```

**Requirements**: Node.js 18+, TypeScript 5.0+ (if using TypeScript)

**For VS Code Extensions:** If you're building a VS Code Language Model Chat Provider, also install `[@agentsy/vscode](../vscode#readme)`:

```bash
npm install @agentsy/vscode @agentsy/core vscode
```

## Quick Start

```typescript
import { LLMStreamProcessor } from '@agentsy/core/processor';

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

### `@agentsy/core/thinking` — ThinkingParser

Chunk-by-chunk extraction of `<think>` blocks. Returns `[thinkingContent, regularContent]` on every call.

```typescript
import { ThinkingParser } from '@agentsy/core/thinking';

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

### `@agentsy/core/xml-filter` — XmlStreamFilter

Stream-safe scrubbing of XML context and privacy blocks.

```typescript
import { createXmlStreamFilter } from '@agentsy/core/xml-filter';

const filter = createXmlStreamFilter({ enforcePrivacyTags: true });

for await (const chunk of llmStream) {
  output.write(filter.write(chunk));
}
output.write(filter.end());
```

Privacy tags are enforced by default (`enforcePrivacyTags: true`). Pass `enforcePrivacyTags: false` to opt out explicitly.

---

### `@agentsy/core/context` — Context splitting & dedup

```typescript
import { splitLeadingXmlContextBlocks, dedupeXmlContextBlocksByTag, stripXmlContextTags } from '@agentsy/core/context';

const { contextBlocks, remaining } = splitLeadingXmlContextBlocks(response);
const unique = dedupeXmlContextBlocksByTag(contextBlocks);
const clean = stripXmlContextTags(remaining);
```

---

### `@agentsy/core/tool-calls` — XML tool-call extraction

```typescript
import { extractXmlToolCalls, buildXmlToolSystemPrompt } from '@agentsy/core/tool-calls';

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

### `@agentsy/core/structured` — JSON parsing & validation

```typescript
import { parseJson, validateJsonSchema } from '@agentsy/core/structured';

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

### `@agentsy/core/agent` — Multi-step agent loops

Execute multi-step reasoning loops with automatic tool handling and configurable stopping conditions.

```typescript
import { createAgentLoop } from '@agentsy/core/agent';

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

### `@agentsy/core/normalizers` — Provider normalizers

Normalize streaming events from different providers into a common `StreamChunk` shape:

```typescript
import { normalizeOpenAI } from '@agentsy/core/normalizers';

for await (const event of openaiStream) {
  const { chunk } = normalizeOpenAI(event);
  if (chunk) processor.process(chunk);
}
```

Supported: `openai`, `openaiResponses`, `anthropic`, `gemini`, `mistral`, `cohere`, `ollama`, `bedrock`, `hfTgi`, `zai`.

---

### `@agentsy/core/adapters` — High-level adapters

```typescript
import { createGenericAdapter } from '@agentsy/core/adapters';

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

Mistral outbound request mapping is available via `@agentsy/core/adapters/mistral`:

```typescript
import { toMistralMessages } from '@agentsy/core/adapters/mistral';

const mistralMessages = toMistralMessages([
  {
    role: 'system',
    parts: [{ type: 'text', text: 'You are concise.' }],
  },
  {
    role: 'user',
    parts: [{ type: 'text', text: 'Search docs for tool calls.' }],
  },
]);
```

OpenAI-compatible outbound mapping (including DeepSeek, Kimi, Qwen, Llama, and Granite) is centralized in `@agentsy/core/adapters/openai-compatible`:

```typescript
import {
  OPENAI_COMPATIBLE_PROVIDERS,
  toOpenAICompatibleMessages,
} from '@agentsy/core/adapters/openai-compatible';

const messages = toOpenAICompatibleMessages([
  {
    role: 'user',
    parts: [{ type: 'text', text: 'Call weather tool for Boston.' }],
  },
]);

console.log(OPENAI_COMPATIBLE_PROVIDERS);
// ['openai', 'deepseek', 'kimi', 'qwen', 'llama', 'granite']
```

Processor callback parity helper for stable callback wiring across versions:

```typescript
import { createProcessorEventAdapter, LLMStreamProcessor } from '@agentsy/core/processor';

const processor = new LLMStreamProcessor();
const adapter = createProcessorEventAdapter(processor, {
  onToolCallDelta: delta => console.log(delta),
  onStep: (stepIndex, usage) => console.log(stepIndex, usage),
  onFinish: (finishReason, usage) => console.log(finishReason, usage),
});

// later
adapter.dispose();
```

---

### `@agentsy/core/ui` — Event-sourced conversation state

```typescript
import { LLMStreamProcessor } from '@agentsy/core/processor';
import { createConversationStoreFromProcessor } from '@agentsy/core/ui';

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

### `@agentsy/core/pipeline` — Output transforms

```typescript
import { createSmoothStream, createThinkingFilter } from '@agentsy/core/pipeline';

const processor = new LLMStreamProcessor({
  transforms: [createThinkingFilter(), createSmoothStream({ chunkSize: 4, delayMs: 25 })],
});
```

`createSmoothStream()` splits large text bursts into smaller parts and can optionally pause between sub-chunks with `delayMs` for steadier UI output.

---

### `@agentsy/core/formatting` — Output sanitization

```typescript
import { sanitizeNonStreamingModelOutput, formatXmlLikeResponseForDisplay } from '@agentsy/core/formatting';
```

---

### `@agentsy/core/markdown` — Markdown utilities

```typescript
import { appendToBlockquote } from '@agentsy/core/markdown';
```

---

## Renderers

**Renderers** stream LLM response content to specific output targets (plain text, formatted terminal, browser DOM, VS Code chat). Each renderer owns an internal `LLMStreamProcessor` and handles thinking blocks, tool calls, step changes, and error callbacks.

All renderers use a factory pattern and implement the same `{ write(chunk), writeChunk(streamChunk), end() }` interface:

```typescript
import { createPlainTextRenderer } from '@agentsy/core/renderers/plain';

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
import { createPlainTextRenderer } from '@agentsy/core/renderers/plain';

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
import { createCliRenderer } from '@agentsy/core/renderers/cli';

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
import { createStreamingMarkdownRenderer } from '@agentsy/core/renderers/streaming-md';

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

### VS Code integrations

`@agentsy/core` is editor-agnostic. VS Code-specific renderers and utilities live in [`@agentsy/vscode`](../vscode#readme), including:

- `createVSCodeChatRenderer`
- `createVSCodeAgentLoop`
- `cancellationTokenToAbortSignal`
- `ApiKeyManager`, `UsageStatusBar`, and MCP helpers

Install both packages when building VS Code extensions:

```bash
npm install @agentsy/core @agentsy/vscode vscode
```

### Ink Terminal Renderer

Beautiful, themeable terminal output for CLI/TUI applications built on React/Ink.
**Requires peer dependencies**: `npm install ink react`

```typescript
import { createInkRenderer } from '@agentsy/core/renderers/ink';

const renderer = await createInkRenderer({
  processor, // LLMStreamProcessor instance
  showThinking: true,
  thinkingStyle: 'blockquote', // 'blockquote' | 'inline' | 'suppress'
  showToolCalls: true,
  markdown: true,
  syntaxHighlight: true, // Code fence highlighting (requires cli-highlight)
  theme: 'catppuccin-mocha', // See available themes below
  screenReader: false, // Accessibility mode
  keyboard: {
    enabled: true,
    onInterrupt: () => process.exit(0),
    onCancel: () => renderer.end(),
  },
  onWarning: msg => console.warn(msg),
  onFinish: () => console.log('Stream complete'),
});

// Stream chunks via processor events
processor.on('text', delta => renderer.write(delta));
processor.on('done', () => renderer.end());

renderer.unmount(); // Cleanup when done
```

**Available Themes:**

- `default`, `dark`, `light`, `minimal` — Basic themes
- `dracula` — Dark purple/cyan theme
- `catppuccin-mocha`, `catppuccin-latte`, `catppuccin-macchiato`, `catppuccin-frappe` — Pastel Catppuccin palette
- `ayu-mirage` — Dark gray/amber theme
- `houston` — Astro's dark blue/mint theme
- `one-dark` — Classic Atom One Dark theme
- `one-candy` — One Dark with pastel candy accents
- `github-dark` — GitHub Primer dark theme

**Custom Themes:**

```typescript
import type { Theme } from '@agentsy/core/renderers/ink';

const customTheme: Theme = {
  thinking: { borderColor: 'magenta', textColor: 'magenta', spinnerColor: 'magenta' },
  toolCall: { pendingColor: 'yellow', doneColor: 'green', pendingSymbol: '?', doneSymbol: '✓' },
  text: { cursorSymbol: '|', dimColor: false },
  border: { style: 'round', color: 'gray' },
  highlight: { theme: 'monokai' },
};

const renderer = await createInkRenderer({ theme: customTheme, ... });
```

**Thinking Styles:**

- `blockquote` (default): Render as bordered block with spinner
- `inline`: Render as italic inline text with prefix
- `suppress`: Hide thinking blocks entirely

**Accessibility:**

Set `screenReader: true` to disable animations and output plain text for screen reader users.

---

## Error Handling

| Category | Behaviour |
| -------- | --------- |
