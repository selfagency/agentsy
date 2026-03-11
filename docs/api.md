# API Reference

Complete API documentation for `llm-stream-parser`. All exports are available from the root or via subpath imports.

## Module Exports

### Root export

```typescript
import * from 'llm-stream-parser';
```

### Subpath exports

```typescript
import { ThinkingParser } from 'llm-stream-parser/thinking';
import { createXmlStreamFilter, XmlStreamFilter } from 'llm-stream-parser/xml-filter';
import { extractXmlToolCalls, buildXmlToolSystemPrompt } from 'llm-stream-parser/tool-calls';
import { splitLeadingXmlContextBlocks, dedupeXmlContextBlocksByTag, stripXmlContextTags } from 'llm-stream-parser/context';
import { parseJson, validateJsonSchema, buildFormatInstructions, buildRepairPrompt, pipe } from 'llm-stream-parser/structured';
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
  openingTag?: string;  // Default: '<think>'
  closingTag?: string;  // Default: '</think>'
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
  static forModel(
    modelId: string,
    thinkingTagMap?: Map<string, [string, string]>
  ): ThinkingParser;

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
const parser = ThinkingParser.forModel('deepseek');     // <think></think>
const parser2 = ThinkingParser.forModel('granite');     // <|thinking|></|thinking|>
const parser3 = ThinkingParser.forModel('claude-opus');  // <think></think>

// Custom model mappings
const customMap = new Map([
  ['my-model', ['<reasoning>', '</reasoning>']],
]);
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
  enforcePrivacyTags?: boolean;  // Default: true
  maxXmlNestingDepth?: number;
  onWarning?: (message: string, context?: Record<string, unknown>) => void;
}

export class XmlStreamFilter {
  constructor(options?: XmlStreamFilterOptions);

  // Write a chunk and get scrubbed output
  write(chunk: string): string;

  // Finalize and flush any buffered content
  end(): string;

  // Reset to initial state
  reset(): void;
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
  leading: Array<{ tag: string; content: string }>;
  remaining: string;
};

// Deduplicate context blocks by tag
function dedupeXmlContextBlocksByTag(
  blocks: Array<{ tag: string; content: string }>
): Array<{ tag: string; content: string }>;

// Remove all XML context tags
function stripXmlContextTags(input: string): string;
```

**Example:**

```typescript
const { leading, remaining } = splitLeadingXmlContextBlocks(response);
const deduplicated = dedupeXmlContextBlocksByTag(leading);
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
// Extract tool calls from response text
function extractXmlToolCalls(
  input: string,
  knownTools: Set<string>
): XmlToolCall[];

// Build system prompt for tool use
function buildXmlToolSystemPrompt(knownTools: Set<string>): string;
```

**Example:**

```typescript
const toolCalls = extractXmlToolCalls(response, new Set(['search', 'edit_file']));

for (const call of toolCalls) {
  console.log(`Calling ${call.name} with:`, call.parameters);
  const result = await executeToolInHost(call.name, call.parameters);
}

// Generate system prompt for models
const systemPrompt = buildXmlToolSystemPrompt(new Set(['search', 'edit_file', 'run_tests']));
```

## Structured Output Parsing

> **Subpath**: `llm-stream-parser/structured`

JSON parsing with schema validation, repair prompts, and composable pipelines.

### parseJson

```typescript
export interface ParseJsonOptions {
  selectMostComprehensive?: boolean;  // Default: true
  repairIncomplete?: boolean;
  maxJsonDepth?: number;              // Default: 64
  maxJsonKeys?: number;               // Default: 10_000
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
}

function validateJsonSchema<T = unknown>(
  text: string,
  schema: Record<string, unknown>,
  options?: ValidateJsonSchemaOptions
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
  error: string | Error;
  schema: Record<string, unknown>;
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
  parseThinkTags?: boolean;              // Default: true
  scrubContextTags?: boolean;            // Default: true
  extraScrubTags?: Set<string>;
  overrideScrubTags?: Set<string>;
  enforcePrivacyTags?: boolean;          // Default: true
  knownTools?: Set<string>;
  modelId?: string;
  thinkingOpenTag?: string;
  thinkingCloseTag?: string;
  thinkingTagMap?: Map<string, [string, string]>;
  onWarning?: (message: string, context?: Record<string, unknown>) => void;
  maxInputLength?: number;               // Default: 256 KB
  maxToolCallsPerMessage?: number;       // Default: 64
  maxToolArgumentBytes?: number;         // Default: 128 KB
  maxXmlNestingDepth?: number;
}

export interface ProcessedOutput {
  thinking: string;
  content: string;
  toolCalls: XmlToolCall[];
  done: boolean;
  parts: Array<
    | { type: 'text'; text: string }
    | { type: 'thinking'; text: string }
    | { type: 'tool_call'; call: XmlToolCall }
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
  on<K extends keyof StreamEventMap>(
    event: K,
    listener: StreamEventMap[K]
  ): this;

  // Unsubscribe from events
  off<K extends keyof StreamEventMap>(
    event: K,
    listener: StreamEventMap[K]
  ): this;
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
processor.on('thinking', (delta) => console.log('[thinking]', delta));
processor.on('text', (delta) => console.log('[text]', delta));
processor.on('tool_call', (call) => console.log('[tool]', call.name));

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
// Append content to markdown blockquote
function appendToBlockquote(text: string, append: string): string;
```

**Example:**

```typescript
const md = '> existing quote';
const updated = appendToBlockquote(md, 'new line');
// Result: '> existing quote\n> new line'
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
- `maxXmlNestingDepth`: Maximum XML nesting (default: unlimited)
- `maxToolCallsPerMessage`: Maximum tool calls (default: 64)
- `maxToolArgumentBytes`: Maximum tool argument size (default: 128 KB)

### Privacy

Context scrubbing is enabled by default:

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
