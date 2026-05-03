# Change Log

## [Unreleased]

## [0.3.1] - 2026-05-03

## What's Changed
* fix(renderers): align VS Code contracts, improve Ink renderer, and clean up code quality issues by @selfagency in <https://github>.com/selfagency/llm-stream-parser/pull/47


**Full Changelog**: <https://github>.com/selfagency/llm-stream-parser/compare/v0.3.0...v0.3.1

_Source: changes from v0.3.0 to v0.3.1._


## [0.3.0] - 2026-05-03

## What's Changed

- feat: multi-phase LLM streaming enhancements with schema quality improvements by @selfagency in <https://github.com/selfagency/llm-stream-parser/pull/43>
- feat: Complete AG-UI protocol integration (Phases 1-4) by @selfagency in <https://github.com/selfagency/llm-stream-parser/pull/44>
- feat: complete remediation plan for lifecycle, UI event sourcing, and renderer step propagation by @selfagency in <https://github.com/selfagency/llm-stream-parser/pull/45>

**Full Changelog**: <https://github.com/selfagency/llm-stream-parser/compare/v0.2.0...v0.3.0>

_Source: changes from v0.2.0 to v0.3.0._

### Breaking Changes

- **`buildXmlToolSystemPrompt()` signature change**: The function now accepts an optional second parameter `options: BuildXmlToolSystemPromptOptions`. While backwards compatible (the parameter is optional and defaults to `{ format: 'xml' }`), this is a minor signature change. Callers using TypeScript with strict settings may need to update type signatures.
  - Old: `buildXmlToolSystemPrompt(tools: readonly XmlToolInfo[]): string`
  - New: `buildXmlToolSystemPrompt(tools: readonly XmlToolInfo[], options?: BuildXmlToolSystemPromptOptions): string`

### Deprecated

- **`vscode` adapter** — The legacy `createGenericAdapter` exported from `/adapters` for VS Code is now deprecated. Use `createVSCodeChatRenderer()` instead for full API support including thinking blocks, tool callbacks, and usage reporting. See [migration guide](./docs/migration/vscode-adapter-deprecation.md)

### Added

#### Agent Loops

- **`createAgentLoop()` factory** for multi-step LLM execution with configurable stop conditions and automatic tool handling
  - Supports multiple stop conditions (array of predicates)
  - Built-in conversation state management and message trimming
  - `onStep` callback for monitoring loop progress
  - Configurable max steps (default: 20)
  - Safe abort via `abort()` method
  - Full streaming support: yields `OutputPart[]` across all steps

- **`AgentLoopOptions`, `AgentLoopHandle`, `StepResult`, `AgentLoopState` types** for agent loop configuration and state tracking

#### VS Code Chat Integration

- **`createVSCodeChatRenderer()` factory** for streaming LLM responses to VS Code Chat with full API support
  - Type-safe `ChatResponseStream` interface matching VS Code API exactly
  - Automatic thinking block rendering (blockquote/progress/suppress styles)
  - Tool invocation callbacks: `onToolCall()`, `beginToolInvocation()`, `updateToolInvocation()`
  - Token usage reporting: `stream.usage()` support
  - Capability detection for proposed VS Code APIs (thinkingProgress, usage, tool methods)
  - Multi-line blockquote thinking rendering via `appendToBlockquote()`
  - Cancellation support via `onError()` callback

- **`createVSCodeAgentLoop()` factory** — Specialized VS Code renderer for agent loops with `showThinking=true` by default

- **`cancellationTokenToAbortSignal()` utility** — Bridge VS Code `CancellationToken` to Web `AbortSignal` for fetch/stream operations
  - Handles pre-cancelled tokens
  - Automatic event listener cleanup

- **`VSCodeChatRendererOptions`, `VSCodeAgentLoopOptions` types** for VS Code renderer configuration

- **`ChatResponseStream` interface** — Type-safe interface for VS Code chat response streaming
  - Stable methods: `markdown()`, `progress()`, `anchor()`, `reference()`, `button()`, `filetree()`
  - Proposed methods: `thinkingProgress()`, `beginToolInvocation()`, `updateToolInvocation()`, `usage()`

- **`renderers/vscode` module** with subpath exports for tree-shaking

#### JSON Schema & Tool Definitions

- **`buildNativeToolsArray()` function** for building OpenAI-compatible tool definitions with support for strict mode (DeepSeek, OpenAI structured outputs), enum constraints, and `additionalProperties: false` enforcement
- **Multiple tool-calling format support** in `buildXmlToolSystemPrompt()`:
  - `format: 'xml'` (default) — Custom XML format for most models
  - `format: 'hermes'` — NousResearch Hermes 2 Pro format for Qwen models (Qwen2.5, Qwen3, etc.)
  - `format: 'none'` — No instructions (for models using native API parameters like Ollama's `tools` field)
- **`JsonSchemaProperty` interface** for more complete JSON Schema draft 7 support, including:
  - Full object schema support (`properties`, `required`, `additionalProperties`)
  - Array schemas (`items`, `minItems`, `maxItems`)
  - Numeric constraints (`minimum`, `maximum`, `multipleOf`, etc.)
  - Composition keywords (`anyOf`, `oneOf`, `allOf`, `not`)
  - Schema references (`$ref`, `$defs`, `$def` for DeepSeek compatibility)
  - Enum constraints (`enum`, `const`)
- **Bare JSON fallback** in `extractXmlToolCalls()` for models that emit tool calls without XML wrappers (e.g., models trained on Hermes format that ignore custom XML instructions)
- **New type exports**:
  - `BuildXmlToolSystemPromptOptions` interface
  - `NativeTool` interface
  - `BuildNativeToolsOptions` interface

#### Type Safety & Capabilities

- **Improved type safety** across all modules with stricter TypeScript configurations
- **Capability detection pattern** for optional proposed VS Code APIs (graceful fallback if methods unavailable)
- **Full event-driven architecture** with discriminated union `OutputPart` types

### Changed

- **Improved JSON Schema support** with enhanced `JsonSchemaProperty` interface supporting all JSON Schema draft 7 features
- **Enhanced error handling** in agent loops with better state management and recovery
- **Optimized thinking block rendering** with proper multi-line blockquote support using `appendToBlockquote()`

### Fixed

- **SonarQube code quality issues** resolved
- **Qwik false positives** in builds
- **Type safety issues** in VS Code renderers with proper interface definitions

## [0.2.0] - 2026-05-01

## What's Changed

- chore(deps): bump picomatch from 2.3.1 to 2.3.2 in the npm_and_yarn group across 1 directory by @dependabot[bot] in <https://github>.com/selfagency/llm-stream-parser/pull/35
- chore(deps-dev): bump vite from 7.3.1 to 7.3.2 in the npm_and_yarn group across 1 directory by @dependabot[bot] in <https://github>.com/selfagency/llm-stream-parser/pull/36
- chore(deps): bump basic-ftp from 5.2.0 to 5.2.1 in the npm_and_yarn group across 1 directory by @dependabot[bot] in <https://github>.com/selfagency/llm-stream-parser/pull/37
- chore(deps): bump basic-ftp from 5.2.1 to 5.2.2 in the npm_and_yarn group across 1 directory by @dependabot[bot] in <https://github>.com/selfagency/llm-stream-parser/pull/38
- chore(deps): bump the npm_and_yarn group across 1 directory with 2 updates by @dependabot[bot] in <https://github>.com/selfagency/llm-stream-parser/pull/39
- feat(tool-calls): improve JSON Schema quality for native tool calling by @selfagency in <https://github>.com/selfagency/llm-stream-parser/pull/40
- chore(deps): bump postcss from 8.5.9 to 8.5.13 in the npm_and_yarn group across 1 directory by @dependabot[bot] in <https://github>.com/selfagency/llm-stream-parser/pull/41
- fix: resolve SonarQube code quality issues and Qwik false positives by @selfagency in <https://github>.com/selfagency/llm-stream-parser/pull/42

## New Contributors

- @dependabot[bot] made their first contribution in <https://github>.com/selfagency/llm-stream-parser/pull/35

**Full Changelog**: <https://github>.com/selfagency/llm-stream-parser/compare/v0.1.5...v0.2.0

_Source: changes from v0.1.5 to v0.2.0._

### BREAKING CHANGES

- **`buildXmlToolSystemPrompt()` signature change**: The function now accepts an optional second parameter `options: BuildXmlToolSystemPromptOptions`. While backwards compatible (the parameter is optional and defaults to `{ format: 'xml' }`), this is a minor signature change. Callers using TypeScript with strict settings may need to update type signatures.
  - Old: `buildXmlToolSystemPrompt(tools: readonly XmlToolInfo[]): string`
  - New: `buildXmlToolSystemPrompt(tools: readonly XmlToolInfo[], options?: BuildXmlToolSystemPromptOptions): string`

### Added

- **`buildNativeToolsArray()` function** for building OpenAI-compatible tool definitions with support for strict mode (DeepSeek, OpenAI structured outputs), enum constraints, and `additionalProperties: false` enforcement
- **Multiple tool-calling format support** in `buildXmlToolSystemPrompt()`:
  - `format: 'xml'` (default) — Custom XML format for most models
  - `format: 'hermes'` — NousResearch Hermes 2 Pro format for Qwen models (Qwen2.5, Qwen3, etc.)
  - `format: 'none'` — No instructions (for models using native API parameters like Ollama's `tools` field)
- **`JsonSchemaProperty` interface** for more complete JSON Schema draft 7 support, including:
  - Full object schema support (`properties`, `required`, `additionalProperties`)
  - Array schemas (`items`, `minItems`, `maxItems`)
  - Numeric constraints (`minimum`, `maximum`, `multipleOf`, etc.)
  - Composition keywords (`anyOf`, `oneOf`, `allOf`, `not`)
  - Schema references (`$ref`, `$defs`, `$def` for DeepSeek compatibility)
  - Enum constraints (`enum`, `const`)
- **Bare JSON fallback** in `extractXmlToolCalls()` for models that emit tool calls without XML wrappers (e.g., models trained on Hermes format that ignore custom XML instructions)
- **New type exports**:
  - `BuildXmlToolSystemPromptOptions` interface
  - `NativeTool` interface
  - `BuildNativeToolsOptions` interface
  - `NativeToolParameter` type (deprecated, use `JsonSchemaProperty` instead)

### Fixed

- Resolved SonarQube code quality findings (cyclomatic complexity, string comparison, type unions)
- Fixed false positive Qwik linting errors in test files
- Removed forbidden non-null assertions (25+ instances)
- Improved code quality across normalizers, structured parsing, context handling, and processors

## [0.1.5] - 2026-03-13

**Full Changelog**: <https://github.com/selfagency/llm-stream-parser/compare/v0.1.4...v0.1.5>

_Source: changes from v0.1.4 to v0.1.5._

## [0.1.4] - 2026-03-13

**Full Changelog**: <https://github.com/selfagency/llm-stream-parser/compare/v0.1.3...v0.1.4>

_Source: changes from v0.1.3 to v0.1.4._

## [0.1.3] - 2026-03-13

**Full Changelog**: <https://github.com/selfagency/llm-stream-parser/compare/v0.1.2...v0.1.3>

_Source: changes from v0.1.2 to v0.1.3._

## [0.1.2] - 2026-03-13

**Full Changelog**: <https://github.com/selfagency/llm-stream-parser/compare/v0.1.1...v0.1.2>

_Source: changes from v0.1.1 to v0.1.2._

## [0.1.1] - 2026-03-13

**Full Changelog**: <https://github.com/selfagency/llm-stream-parser/compare/v0.1.0...v0.1.1>

_Source: changes from v0.1.0 to v0.1.1._
