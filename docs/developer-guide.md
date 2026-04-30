# Developer Guide

This document covers local development, testing, and release operations for `@selfagency/llm-stream-parser`.

## Prerequisites

- Node.js 20+
- pnpm (version pinned in `package.json`)
- `task` CLI (optional, recommended)

## Install

```bash
pnpm install
```

`pnpm install` is the only required direct package-manager command for normal development.

## Build and verify

```bash
task compile
task check-types
task unit-tests
task lint
task check-formatting
task formatting
```

## Taskfile workflow

Run tasks via:

```bash
task <task-name>
```

Primary tasks:

- `check-types`
- `lint`
- `check-formatting`
- `formatting`
- `compile`
- `unit-tests`
- `unit-test-coverage`
- `release`
- `test-build-release`
- `watch`

## Testing strategy

- Keep parser behavior deterministic across chunk boundaries.
- Assert safety rails explicitly:
  - privacy scrub defaults
  - tool-call count/size limits
  - JSON depth/key limits
- Add targeted unit tests beside source modules in `src/**`.

## Error Handling Patterns

Public functions follow one of three error handling strategies, chosen by function category:

### Streaming / parsing functions — graceful degradation

Functions that process LLM output (`parseJson`, `extractXmlToolCalls`, `ThinkingParser`, `LLMStreamProcessor`, `XmlStreamFilter`) never throw. They return best-effort results and silently skip malformed input:

- `parseJson` returns `null` when no valid JSON is found.
- `extractXmlToolCalls` returns only successfully parsed tool calls; malformed entries are silently dropped.
- `ThinkingParser.addContent` treats unrecognised input as regular content.
- `LLMStreamProcessor` and `XmlStreamFilter` may emit warnings via `onWarning` callback for overflow conditions (depth exceeded, warning rate limit), but never throw.

### Configuration / setup functions — throw on invalid input

Functions called at setup time (`buildXmlToolSystemPrompt`) throw `Error` when given invalid arguments. These errors can be caught during application initialisation.

### Validation functions — discriminated union results

`validateJsonSchema` returns `{ success: true; data: T } | { success: false; errors: string[] }`. All error conditions are captured in the `errors` array — the function never throws.

## Known Edge Cases & Limitations

### ThinkingParser

- **Multiple thinking blocks**: Supported. When a model emits `<think>A</think>text<think>B</think>`, both blocks are extracted. Content between blocks passes through as regular content.
- **Nested thinking tags**: Supported via depth tracking. `<think>outer<think>inner</think></think>` correctly tracks nesting depth and waits for the outermost closing tag.
- **Tag names are configurable**: Use `ThinkingParser.forModel(modelId)` for automatic detection, or pass custom `openingTag`/`closingTag`.

### appendToBlockquote

- **CRLF handling**: Works correctly with both LF and CRLF line endings. The carriage return in CRLF is preserved; only the newline character is used as the split point for inserting `>` prefixes.

### LLMStreamProcessor

- **Lifecycle**: Call `reset()` between conversations when reusing a processor. After `flush()`, the processor's `doneEmitted` flag prevents further emissions until `reset()` is called.
- **Warning rate limiting**: After `maxWarnings` (default: 100) warnings are emitted, subsequent warnings are silently dropped. Call `reset()` to clear the counter.

### Incomplete stream detection

`flush()` and `processComplete()` return a `ProcessedOutput` that includes two fields for detecting prematurely-terminated streams:

- `incomplete: boolean` — `true` if any incompleteness was detected.
- `incompleteness: IncompletenessDetail[]` — array of `{ type, reason }` objects describing each issue.

Possible `type` values:

| Type           | Meaning                                                                                       |
| -------------- | --------------------------------------------------------------------------------------------- |
| `"thinking"`   | An opening thinking tag was seen but no matching closing tag arrived before the stream ended. |
| `"xml"`        | The accumulated content contains XML open tags with no matching close tags.                   |
| `"tool_calls"` | A bare-XML tool call was extracted with no parsed parameters (likely truncated).              |

**Example — detecting incomplete streams:**

```ts
const processor = new LLMStreamProcessor({ parseThinkTags: true });

for await (const chunk of llmStream) {
  processor.process(chunk);
}

const result = processor.flush();

if (result.incomplete) {
  console.warn('Stream ended prematurely:', result.incompleteness);
  // result.incompleteness might be:
  // [{ type: 'thinking', reason: 'Unclosed thinking tag' }]
}
```

**When to expect incompleteness:**

- Token limit reached mid-response (LLM cut off inside a `<think>` block).
- Network error terminating the stream before all XML tags were closed.
- Tool call XML split at a chunk boundary, with the closing tag never delivered.

### validateJsonSchema

- **Regex patterns**: Patterns longer than 1024 characters are rejected to prevent ReDoS. This is a security measure, not a schema limitation.
- **External validators**: The `validatorTimeoutMs` option is reserved for future use and **not currently enforced**. Callers should ensure their validator function completes promptly. Async validators returning Promises are not supported and will be treated as truthy.
- **Built-in validation**: The built-in validator covers `type`, `enum`, `required`, `properties`, `additionalProperties`, `items`, `minItems`, `maxItems`, `minimum`, `maximum`, and `pattern`. Complex schemas (e.g., `oneOf`, `allOf`, `$ref`) require an external validator adapter.

### XmlStreamFilter

- **Privacy tags are always enforced** by default, even when `overrideScrubTags` is provided. Set `enforcePrivacyTags: false` to override (not recommended).
- **Max nesting depth**: Defaults to 64. Deeply nested XML beyond this limit is treated as plain text.

## Release flow

The package uses scripted release automation:

1. Build with `pnpm run build` (runs `postbuild` to prepare `dist/package.json`).
2. Trigger release with `task release -- <version>`.
3. CI workflows:
   - `Test & Build`
   - `Release`

When possible, prefer `task` commands over direct `pnpm run ...` scripts for consistency.

The release script publishes `./dist` to npm:

- stable versions → `latest`
- prerelease versions → `next`
