# Change Log

## [Unreleased]

## [0.2.0] - 2026-04-30

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

**Full Changelog**: <https://github.com/selfagency/llm-stream-parser/compare/v0.1.5...v0.2.0>

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
