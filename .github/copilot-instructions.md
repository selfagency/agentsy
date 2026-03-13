# Copilot Instructions — @selfagency/llm-stream-parser

Composable parsers and stream processing utilities for LLM responses. TypeScript, ESM-first, published as `@selfagency/llm-stream-parser` on npm.

## Tool Priority

Always prefer higher-level tools over the terminal. The CLI is a **last resort**.

1. **VS Code extension commands** — use built-in IDE actions (rename symbol, find references, run tests via Test Explorer, etc.) whenever possible.
2. **Chat participants** — use `@workspace`, `@terminal`, `@beans`, and other chat participants for context and task management.
3. **MCP servers** — use available MCP tools (Git, GitHub, Playwright, Desktop Commander, etc.) for operations instead of shelling out.
4. **Skills** — invoke relevant skills for specialized tasks (Beans workflows, testing, Svelte, TypeScript types, etc.).
5. **CLI (last resort)** — only fall back to terminal commands when no dedicated tool, participant, skill, or MCP server can accomplish the task.

## Documentation Search

Three MCP-based documentation sources are available. **Always consult documentation before implementing** — do not guess at API surfaces or library behavior.

- **DeepWiki** (`mcp_cognitionai_d_*`) — AI-powered documentation for any GitHub repository. Use `ask_question` for targeted queries or `read_wiki_contents` for full docs.
- **Exa** (`mcp_exa_*`) — web search and code context retrieval. Use for finding examples, blog posts, and up-to-date references.
- **Context7** — up-to-date library documentation, correct syntax, and best practices via the Context7-Expert agent.

## Commands

Prefer **Taskfile** commands over `pnpm run` scripts. The Taskfile provides the canonical task definitions.

```bash
task unit-tests        # vitest run src
task check-types       # tsc --noEmit
task compile           # tsup → dist/
task lint              # oxlint .
task format            # oxfmt . --write
task check-all         # check-types + lint + check-formatting
task test-all          # run all tests
task precommit         # check-types + lint-fix + format
```

Always run `task check-types` and `task unit-tests` before considering work complete.

## TypeScript

- **Strict mode** — `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `isolatedModules` are all enabled. Never use `any`.
- **ESM imports** — Always use `.js` extensions in relative imports (e.g., `from './parsing.js'`), even in `.ts` files.
- **Module system** — `"type": "module"` in package.json. Dual ESM/CJS output via tsup.
- **Target** — ES2022.

## Project Structure

```text
src/
  index.ts              ← barrel re-exports all modules
  thinking/             ← ThinkingParser (streaming think-tag extraction)
  xml-filter/           ← XmlStreamFilter (XML tag scrubbing/filtering)
  tool-calls/           ← XML tool call extraction & system prompt building
  context/              ← XML context tag splitting/stripping/deduplication
  structured/           ← JSON parsing, validation, repair, Zod adapter
  processor/            ← LLMStreamProcessor (unified event-driven processor)
  formatting/           ← Display formatting & sanitization
  markdown/             ← Markdown utilities (blockquote appending)
  adapters/             ← Generic and VS Code adapter integrations
```

Each module has its own `index.ts` barrel export. Tests are colocated (`module.test.ts` next to source).

## Coding Conventions

### Architecture

- **Factory functions** over direct class instantiation: `createXmlStreamFilter()`, `createGenericAdapter()`, `processStream()`.
- **Classes** for stateful parsers: `ThinkingParser`, `LLMStreamProcessor`. Use private fields and public method APIs.
- **Options objects** with optional properties and sensible defaults via `??` (nullish coalescing). Export default constants (e.g., `DEFAULT_MAX_JSON_DEPTH`).
- **Barrel exports** — every module re-exports its public API through `index.ts`.

### Naming

- Factory functions: `create*` (e.g., `createXmlStreamFilter`)
- Parser classes: `*Parser` (e.g., `ThinkingParser`)
- Processor classes: `*Processor` (e.g., `LLMStreamProcessor`)
- Validators: `validate*` (e.g., `validateJsonSchema`)
- Builders: `build*` (e.g., `buildXmlToolSystemPrompt`)
- Extractors: `extract*` (e.g., `extractXmlToolCalls`)

### Error Handling

- **Silent failure by default** for stream processing — malformed input is skipped, not thrown. Parsers must be resilient to garbage input.
- **Explicit throws** only for critical validation (invalid tool names, missing peer dependencies).
- **Warning callbacks** (`onWarning`) for recoverable issues. No custom error classes — use plain `Error` with descriptive messages.

### Streaming Patterns

- Chunk-based `write(chunk)` / `end()` interface for filters.
- `addContent(chunk)` + `flush()` pattern for parsers that accumulate state across chunks.
- Async generators (`async function*`) for composable stream pipelines.
- Event emitter pattern with typed listener maps for `LLMStreamProcessor`.

### Security

- Enforce limits: nesting depth, key counts, input length, tool call counts, argument sizes. Use the existing `DEFAULT_*` constants.
- Privacy tags (`PRIVACY_TAG_NAMES`) are always scrubbed by default (`enforcePrivacyTags: true`).
- Never trust LLM output — all parsers must handle adversarial/malformed input gracefully.

## Testing

- **Vitest** — tests colocated as `*.test.ts` files. Use `describe()` / `it()` / `expect()`.
- Test streaming behavior by feeding content chunk-by-chunk (simulating real streaming).
- Test edge cases: partial tags split across chunks, empty input, malformed XML/JSON, whitespace handling.
- Use `vi.fn()` for callback spies.
- Parsers should "never throw" on malformed input — verify with adversarial test cases.

## Package Exports

The package provides granular subpath exports for tree-shaking:

```ts
import { ThinkingParser } from '@selfagency/llm-stream-parser/thinking';
import { createXmlStreamFilter } from '@selfagency/llm-stream-parser/xml-filter';
import { extractXmlToolCalls } from '@selfagency/llm-stream-parser/tool-calls';
import { parseJson } from '@selfagency/llm-stream-parser/structured';
```

When adding a new module, update `package.json` exports, `tsup.config.ts` entry points, and `src/index.ts` barrel export.

## Dependencies

- **Runtime**: `saxophone` (SAX-based streaming XML parser). Types are shimmed locally in `src/saxophone.d.ts`.
- **Package manager**: pnpm (see `packageManager` field).
- **Linter/formatter**: oxlint + oxfmt (not ESLint/Prettier).
