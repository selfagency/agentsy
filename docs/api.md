# API Reference

Complete API documentation for `llm-stream-parser`. All exports are available from the root or via subpath imports.

## Module Exports

### Root export

```typescript
import * as llmStreamParser from 'llm-stream-parser';
```

### Subpath exports

```typescript
import { ThinkingParser } from 'llm-stream-parser/thinking';
import { createXmlStreamFilter, XmlStreamFilter } from 'llm-stream-parser/xml-filter';
import { extractXmlToolCalls, buildXmlToolSystemPrompt } from 'llm-stream-parser/tool-calls';
import {
  splitLeadingXmlContextBlocks,
  dedupeXmlContextBlocksByTag,
  stripXmlContextTags,
} from 'llm-stream-parser/context';
import {
  parseJson,
  validateJsonSchema,
  buildFormatInstructions,
  buildRepairPrompt,
  pipe,
  streamJson,
  zodToJsonSchema,
  validateWithZod,
  repairWithLLM,
} from 'llm-stream-parser/structured';
import { sanitizeNonStreamingModelOutput, formatXmlLikeResponseForDisplay } from 'llm-stream-parser/formatting';
import { LLMStreamProcessor } from 'llm-stream-parser/processor';
import { appendToBlockquote } from 'llm-stream-parser/markdown';
import { processStream } from 'llm-stream-parser/adapters';
```

## Thinking Extraction

> **Subpath**: `llm-stream-parser/thinking`

Streaming-first parser for extracting reasoning sections from LLM responses.

### ThinkingParser

```typescript
export interface ThinkingParserOptions {
  openingTag?: string; // Default: '<think>'
  closingTag?: string; // Default: '</think>'
}

export class ThinkingParser {
  constructor(options?: ThinkingParserOptions);

  // Process a chunk, returning [thinkingContent, regularContent]
  addContent(chunk: string): [string, string];

  // Flush any buffered content
  flush(): [string, string];

  // Reset parser state
  reset(): void;

  // Static factory for model-specific tag detection
  static forModel(modelId: string, thinkingTagMap?: Map<string, [string, string]>): ThinkingParser;

  // Access tags
  readonly openingTag: string;
  readonly closingTag: string;
}
```

**Example:**

```typescript
const parser = new ThinkingParser({ openingTag: '<think>', closingTag: '</think>' });

for await (const chunk of stream) {
  const [thinking, content] = parser.addContent(chunk);
  displayThinking(thinking);
  displayContent(content);
}

const [finalThinking, finalContent] = parser.flush();
```

**Model detection:**

```typescript
// Automatically detect thinking tags for common models
const parser = ThinkingParser.forModel('deepseek'); // <think></think>
const parser2 = ThinkingParser.forModel('granite'); // <|thinking|></|thinking|>
const parser3 = ThinkingParser.forModel('claude-opus'); // <think></think>

// Custom model mappings
const customMap = new Map([['my-model', ['<reasoning>', '</reasoning>']]]);
const parser4 = ThinkingParser.forModel('my-model', customMap);
```

## XML/Context Filtering

> **Subpath**: `llm-stream-parser/xml-filter` + `llm-stream-parser/context`

Stream-safe XML context block filtering and deduplication.

### XmlStreamFilter (xml-filter)

```typescript
export interface XmlStreamFilterOptions {
  extraScrubTags?: Set<string>;
  overrideScrubTags?: Set<string>;
  enforcePrivacyTags?: boolean; // Default: true
  maxXmlNestingDepth?: number;
  onWarning?: (message: string, context?: Record<string, unknown>) => void;
}

export interface XmlStreamFilter {
  // Write a chunk and get scrubbed output
  write(chunk: string): string;

  // Finalize and flush any buffered content
  end(): string;
}

export function createXmlStreamFilter(options?: XmlStreamFilterOptions): XmlStreamFilter;
```

**Example:**

```typescript
const filter = createXmlStreamFilter({
  enforcePrivacyTags: true,
  maxXmlNestingDepth: 10,
});

for await (const chunk of stream) {
  const filtered = filter.write(chunk);
  output.write(filtered);
}

const final = filter.end();
output.write(final);
```

### Context Functions (context)

```typescript
// Split leading context blocks from content
function splitLeadingXmlContextBlocks(input: string): {
  contextBlocks: string[];
  remaining: string;
};

// Deduplicate context blocks by tag (accepts array of XML block strings)
function dedupeXmlContextBlocksByTag(blocks: string[]): string[];

// Remove all XML context tags
function stripXmlContextTags(input: string): string;
```

**Example:**

```typescript
const { contextBlocks, remaining } = splitLeadingXmlContextBlocks(response);
const deduplicated = dedupeXmlContextBlocksByTag(contextBlocks);
const stripped = stripXmlContextTags(remaining);
```

## Tool-Call Extraction

> **Subpath**: `llm-stream-parser/tool-calls`

Extract structured tool calls from XML format in responses.

### Types

```typescript
export interface XmlToolCall {
  name: string;
  parameters: Record<string, unknown>;
  format: 'bare-xml' | 'json-wrapped';
}
```

### Functions

```typescript
export interface XmlToolInfo {
  name: string;
  description?: string;
  inputSchema?: {
    properties?: Record<string, { description?: string; type?: string }>;
    required?: string[];
  };
}

// Extract tool calls from response text
function extractXmlToolCalls(input: string, knownTools: Set<string>): XmlToolCall[];

// Build system prompt for tool use
function buildXmlToolSystemPrompt(tools: readonly XmlToolInfo[]): string;
```

**Example:**

```typescript
const toolCalls = extractXmlToolCalls(response, new Set(['search', 'edit_file']));

for (const call of toolCalls) {
  console.log(`Calling ${call.name} with:`, call.parameters);
  const result = await executeToolInHost(call.name, call.parameters);
}

// Generate system prompt for models
const tools: XmlToolInfo[] = [
  {
    name: 'search',
    description: 'Search the web',
    inputSchema: { properties: { query: { type: 'string' } }, required: ['query'] },
  },
  { name: 'edit_file', description: 'Edit a file' },
  { name: 'run_tests', description: 'Run tests' },
];
const systemPrompt = buildXmlToolSystemPrompt(tools);
```

## Structured Output Parsing

> **Subpath**: `llm-stream-parser/structured`

JSON parsing with schema validation, repair prompts, and composable pipelines.

### parseJson

```typescript
export interface ParseJsonOptions {
  selectMostComprehensive?: boolean; // Default: true
  repairIncomplete?: boolean;
  maxJsonDepth?: number; // Default: 64
  maxJsonKeys?: number; // Default: 10_000
}

function parseJson(text: string, options?: ParseJsonOptions): unknown | null;
```

Returns parsed JSON or `null` if parsing fails.

**Example:**

```typescript
const data = parseJson('{"name": "test"}');
if (data !== null) {
  console.log(data);
}

// With limits
const limitedData = parseJson(text, {
  maxJsonDepth: 10,
  maxJsonKeys: 100,
  selectMostComprehensive: true,
});
```

### validateJsonSchema

```typescript
export interface ValidateJsonSchemaOptions extends ParseJsonOptions {
  validator?: JsonSchemaValidator;
  validatorTimeoutMs?: number; // Reserved — not currently enforced
}

function validateJsonSchema<T = unknown>(
  text: string,
  schema: Record<string, unknown>,
  options?: ValidateJsonSchemaOptions,
): { success: true; data: T } | { success: false; errors: string[] };
```

**Example:**

```typescript
const schema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    age: { type: 'number' },
  },
};

const result = validateJsonSchema(response, schema);

if (result.success) {
  console.log('Valid:', result.data);
} else {
  console.error('Invalid:', result.errors);
}
```

### buildFormatInstructions

```typescript
function buildFormatInstructions(schema: Record<string, unknown>): string;
```

Generate instructions for models to format output according to schema.

### buildRepairPrompt

```typescript
function buildRepairPrompt(options: {
  failedOutput: string;
  error: string;
  schema?: Record<string, unknown>;
  originalPrompt?: string;
}): string;
```

**Example:**

```typescript
let result = validateJsonSchema(response, schema);

if (!result.success) {
  const repairPrompt = buildRepairPrompt({
    failedOutput: response,
    error: result.errors[0],
    schema,
    originalPrompt: originalUserPrompt,
  });

  // Ask model to fix
  response = await chat([...messages, { role: 'user', content: repairPrompt }]);
  result = validateJsonSchema(response, schema);
}
```

### pipe

```typescript
function pipe<T>(...fns: Array<(input: T) => T>): (input: T) => T;
```

Compose multiple parser functions.

**Example:**

```typescript
const parsed = parseJson(response);
if (parsed === null) throw new Error('Parse failed');

const result = validateJsonSchema(JSON.stringify(parsed), schema);
if (!result.success) throw new Error('Validation failed');

const data = result.data;
```

### streamJson

```typescript
export interface StreamJsonOptions extends ParseJsonOptions {
  emitPartials?: boolean;  // Default: true
}

export interface StreamJsonResult<T = unknown> {
  value: T;
  isPartial: boolean;
}

async function* streamJson<T = unknown>(
  source: AsyncIterable<string>,
  options?: StreamJsonOptions,
): AsyncGenerator<StreamJsonResult<T>>;
```

Incrementally parse JSON from a text stream, yielding partial and complete objects as chunks arrive. Only emits when the parsed value changes.

**Example:**

```typescript
import { streamJson } from 'llm-stream-parser/structured';

for await (const result of streamJson<{ name: string }>(textStream)) {
  console.log(result.isPartial ? '(partial)' : '(complete)', result.value);
}
```

### repairWithLLM

```typescript
export interface AutoRepairOptions extends ValidateJsonSchemaOptions {
  maxAttempts?: number; // Default: 3
  originalPrompt?: string;
}

export interface AutoRepairResult<T = unknown> {
  success: boolean;
  data?: T;
  errors?: string[];
  attempts: number;
}

async function repairWithLLM<T = unknown>(
  initialOutput: string,
  schema: Record<string, unknown>,
  callLLM: (repairPrompt: string) => Promise<string>,
  options?: AutoRepairOptions,
): Promise<AutoRepairResult<T>>;
```

Automatically retries parsing and validation by sending repair prompts to the LLM. Follows the LangChain `OutputFixingParser` / `RetryParser` pattern.

**Example:**

```typescript
import { repairWithLLM } from 'llm-stream-parser/structured';

const result = await repairWithLLM(llmOutput, schema, async prompt => await callModel(prompt), {
  maxAttempts: 3,
  originalPrompt: 'Return a person object',
});

if (result.success) {
  console.log('Parsed:', result.data);
}
```

### Zod Integration

Optional Zod schema support. Requires `zod` and `zod-to-json-schema` as peer dependencies.

```typescript
export async function zodToJsonSchema(zodSchema: ZodLike): Promise<Record<string, unknown>>;

export async function validateWithZod<T = unknown>(
  text: string,
  zodSchema: ZodLike,
  options?: ValidateJsonSchemaOptions,
): Promise<{ success: true; data: T } | { success: false; errors: string[] }>;
```

**Example:**

```typescript
import { z } from 'zod';
import { validateWithZod } from 'llm-stream-parser/structured';

const PersonSchema = z.object({ name: z.string(), age: z.number() });
const result = await validateWithZod(response, PersonSchema);
```

## Stream Processing

> **Subpath**: `llm-stream-parser/processor`

Orchestrate multiple parsers to process complete LLM stream responses.

### Types

```typescript
export interface StreamChunk {
  content?: string;
  thinking?: string;
  tool_calls?: Array<{ function?: { name?: string; arguments?: unknown } }>;
  done?: boolean;
}

export interface ProcessorOptions {
  parseThinkTags?: boolean; // Default: true
  scrubContextTags?: boolean; // Default: true
  extraScrubTags?: Set<string>;
  overrideScrubTags?: Set<string>;
  enforcePrivacyTags?: boolean; // Default: true
  knownTools?: Set<string>;
  modelId?: string;
  thinkingOpenTag?: string;
  thinkingCloseTag?: string;
  thinkingTagMap?: Map<string, [string, string]>;
  onWarning?: (message: string, context?: Record<string, unknown>) => void;
  maxInputLength?: number; // Default: 256 KB
  maxToolCallsPerMessage?: number; // Default: 64
  maxToolArgumentBytes?: number; // Default: 128 KB
  maxWarnings?: number; // Default: 100
  maxXmlNestingDepth?: number; // Default: 64
}

export interface ProcessedOutput {
  thinking: string;
  content: string;
  toolCalls: XmlToolCall[];
  done: boolean;
  parts: Array<
    { type: 'text'; text: string } | { type: 'thinking'; text: string } | { type: 'tool_call'; call: XmlToolCall }
  >;
}

export type StreamEventMap = {
  text: (delta: string) => void;
  thinking: (delta: string) => void;
  tool_call: (call: XmlToolCall) => void;
  done: () => void;
  warning: (message: string, context?: Record<string, unknown>) => void;
};
```

### LLMStreamProcessor

```typescript
export class LLMStreamProcessor {
  constructor(options?: ProcessorOptions);

  // Process a single chunk
  process(chunk: StreamChunk): ProcessedOutput;

  // Process a complete response (calls process + flush)
  processComplete(response: StreamChunk): ProcessedOutput;

  // Flush any buffered content
  flush(): ProcessedOutput;

  // Reset processor state
  reset(): void;

  // Get accumulated thinking
  get accumulatedThinking(): string;

  // Get accumulated message
  get accumulatedMessage(): {
    thinking: string;
    content: string;
    toolCalls: XmlToolCall[];
  };

  // Subscribe to events
  on<K extends keyof StreamEventMap>(event: K, listener: StreamEventMap[K]): this;

  // Unsubscribe from events
  off<K extends keyof StreamEventMap>(event: K, listener: StreamEventMap[K]): this;
}
```

**Example:**

```typescript
const processor = new LLMStreamProcessor({
  parseThinkTags: true,
  knownTools: new Set(['search', 'edit']),
  modelId: 'claude-opus',
});

// Subscribe to events
processor.on('thinking', delta => console.log('[thinking]', delta));
processor.on('text', delta => console.log('[text]', delta));
processor.on('tool_call', call => console.log('[tool]', call.name));

// Process stream
for await (const chunk of apiStream) {
  const output = processor.process({
    content: chunk.content,
    thinking: chunk.thinking,
    done: chunk.done,
  });

  if (output.done) {
    console.log('Final thinking:', processor.accumulatedThinking);
    break;
  }
}

// Or process complete response
const result = processor.processComplete({
  content: fullResponse,
  done: true,
});
```

## Formatting & Helpers

> **Subpath**: `llm-stream-parser/formatting`

Output normalization and display formatting.

```typescript
// Normalize a non-streaming response for consistency
function sanitizeNonStreamingModelOutput(input: string): string;

// Format XML-like responses for display
function formatXmlLikeResponseForDisplay(input: string): string;
```

**Example:**

```typescript
const normalized = sanitizeNonStreamingModelOutput(response);
const formatted = formatXmlLikeResponseForDisplay(normalized);
console.log(formatted);
```

## Markdown Processing

> **Subpath**: `llm-stream-parser/markdown`

Utilities for working with markdown content.

```typescript
// Format text as a markdown blockquote, prefixing lines with '> '
function appendToBlockquote(text: string, atLineStart: boolean): string;
```

**Example:**

```typescript
// atLineStart=true adds '> ' prefix at the beginning
const quoted = appendToBlockquote('some text\nmore text', true);
// Result: '> some text\n> more text'
```

## Adapters

> **Subpath**: `llm-stream-parser/adapters`

Pre-built adapters for common streaming patterns.

### Generic Adapter

```typescript
export async function* processStream(
  source: AsyncIterable<StreamChunk>,
  options?: ProcessorOptions
): AsyncGenerator<ProcessedOutput>;
```

**Example:**

```typescript
import { processStream } from 'llm-stream-parser/adapters';

for await (const output of processStream(apiStream, options)) {
  console.log('Thinking:', output.thinking);
  console.log('Content:', output.content);
  console.log('Tool calls:', output.toolCalls);
}
```

### Callback-Based Adapter

```typescript
export interface GenericAdapterCallbacks {
  onThinking?: (text: string) => void | Promise<void>;
  onContent?: (text: string) => void | Promise<void>;
  onToolCall?: (call: XmlToolCall) => void | Promise<void>;
  onDone?: () => void | Promise<void>;
}

export interface GenericAdapterOptions extends ProcessorOptions {
  showThinking?: boolean; // Default: true
}

function createGenericAdapter(
  callbacks: GenericAdapterCallbacks,
  options?: GenericAdapterOptions,
): { write(chunk: StreamChunk): Promise<void>; end(): Promise<void> };
```

Environment-agnostic callback adapter. Use for HTTP SSE, WebSocket, CLI, or any non-VS Code environment.

**Example:**

```typescript
import { createGenericAdapter } from 'llm-stream-parser/adapters';

const adapter = createGenericAdapter({
  onContent: text => process.stdout.write(text),
  onToolCall: call => handleTool(call),
  onDone: () => console.log('\n[Done]'),
});

for await (const chunk of apiStream) {
  await adapter.write(chunk);
}
await adapter.end();
```

## Error Handling

All parsing functions handle errors gracefully:

- `parseJson` returns `null` if parsing fails
- `validateJsonSchema` returns `{ success: false; errors }` on validation failure
- `extractXmlToolCalls` returns empty array if no valid calls found
- Streaming processors emit `warning` events for non-critical issues

**Example:**

```typescript
const data = parseJson(response);
if (data === null) {
  console.error('Failed to parse JSON');
}

const validation = validateJsonSchema(response, schema);
if (!validation.success) {
  console.error('Validation failed:', validation.errors);
}
```

## Performance & Safety

### Limits

All parsers enforce configurable limits to prevent DoS:

- `maxJsonDepth`: Maximum nesting depth (default: 64)
- `maxJsonKeys`: Maximum object keys (default: 10,000)
- `maxInputLength`: Maximum input size (default: 256 KB)
- `maxXmlNestingDepth`: Maximum XML nesting (default: 64)
- `maxWarnings`: Maximum warnings emitted per processor lifetime (default: 100)
- `maxToolCallsPerMessage`: Maximum tool calls (default: 64)
- `maxToolArgumentBytes`: Maximum tool argument size (default: 128 KB)

### ReDoS Protection

Schema regex patterns longer than 1024 characters are rejected during validation to prevent Regular Expression Denial of Service attacks. This applies to `pattern` properties in JSON Schema validated via `validateJsonSchema`.

### Privacy

Context scrubbing is enabled by default. Privacy-sensitive tags are always enforced even when `overrideScrubTags` is provided (unless `enforcePrivacyTags` is set to `false`). A warning is emitted when an unsafe override is corrected.

```typescript
const processor = new LLMStreamProcessor({
  scrubContextTags: true,         // Enabled by default
  enforcePrivacyTags: true,       // Enforce privacy markers
  extraScrubTags: new Set([...]), // Add custom tags to scrub
});
```

## Type Safety

Full TypeScript support with strict types:

```typescript
import type { XmlToolCall, ProcessedOutput, StreamChunk } from 'llm-stream-parser';

const output: ProcessedOutput = processor.process(chunk);
const calls: XmlToolCall[] = output.toolCalls;
```
