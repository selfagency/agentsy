# Plan: Ink Renderer for llm-stream-parser

## TL;DR

Create `src/renderers/ink/` — a React/Ink renderer that takes streaming LLM output from `LLMStreamProcessor` and renders it live to the terminal. Follows the existing factory + `RendererHandle` pattern; uses `ink`+`react` as peer deps; lazy-imports both. Text rendered as streaming markdown (via `cli-markdown` → ANSI passthrough, with Claude Code's stable-prefix streaming optimization). Thinking shown as indented blockquote or suppressed. Tool calls animate with a spinner while in-progress, checkmark when done. Returns an `InkRendererHandle` (extends `RendererHandle`) that exposes the Ink `Instance` for lifecycle control. State bridged from factory-scope mutation → React via forceUpdate refs.

---

## Reference Architecture

### Claude Code lessons

- Module-level LRU Map<hash, string> (500 entries) for ANSI output cache — survives component unmount/remount
- `MD_SYNTAX_RE` fast-path: if no markdown syntax chars, skip lexer entirely (~3ms saved per delta)
- `StreamingMarkdown`: split content at last top-level block boundary (scan backwards for `\n\n` or `\n#` etc.); stable prefix memoized via `useRef`, only unstable suffix re-parses per delta
- `<Ansi>` component passes pre-formatted ANSI strings through Ink's pipeline
- `React.memo` with fine-grained equality fn on message components

### Gemini CLI lessons

- `StreamingContext`: external mutable state + forceUpdate ref pattern; React component subscribes via useEffect
- `GeminiMessage` receives `text + isPending` as plain props; `renderMarkdown` flag toggles formatting
- `ThinkingMessage`: subject + description from summarized thought; left-padded with `│` border
- `MainContent`: `<Static>` for completed history items, live area for current turn
- FPS naturally throttled by Ink's `maxFps` (default 30) — no explicit debouncing needed
- `AnsiOutput`: ANSI token array → Ink `<Text>` nodes; each `AnsiToken` maps to color props

### Existing codebase patterns to follow

- Factory: `createXxxRenderer(options?) → XxxRendererHandle`
- `BaseRendererOptions`: showThinking, processor, onError, onToolCall, onToolCallDelta, onFinish, onStep
- Lazy peer dep import: `try { const mod = await import('ink') } catch { throw new Error('…is required…') }`
- Dual ESM/CJS via tsup; `.js` extensions in all relative imports
- Barrel export: one `index.ts` per module

---

## Files to Create

```text
src/renderers/ink/
  createInkRenderer.ts           factory function + InkRendererHandle type
  InkStreamRenderer.tsx          root React component
  components/
    StreamingText.tsx            streaming markdown text with stable-prefix optimization
    ThinkingBlock.tsx            thinking block (blockquote/inline/suppress)
    ToolCallBlock.tsx            spinner→checkmark tool call display
  utils/
    markdownToAnsi.ts            marked lexer + formatToken → ANSI string via cli-markdown or chalk
    tokenCache.ts                module-level LRU cache (500 entries) keyed by content hash
  index.ts                       barrel export
  ink.test.ts                    vitest tests using renderToString
```

## Files to Modify

- `package.json` — add `./renderers/ink` export block; add `ink` + `react` to `peerDependencies`
- `tsup.config.ts` — add `src/renderers/ink/index.ts` as entry point
- `src/renderers/index.ts` — add Ink renderer to module docstring table

---

## Implementation Steps

### Phase 1 — Types & Factory Scaffold

1. **Create `src/renderers/ink/index.ts`** — barrel: `export { createInkRenderer, type InkRendererOptions, type InkRendererHandle } from './createInkRenderer.js'`

2. **Create `src/renderers/ink/createInkRenderer.ts`** — define `InkRendererOptions` (extends `BaseRendererOptions` + `thinkingStyle?: 'blockquote' | 'inline' | 'suppress'`, `showToolCalls?: boolean`, `markdown?: boolean`, `inkOptions?: Partial<RenderOptions>`). Define `InkRendererHandle` (extends `RendererHandle` + `instance: Instance`, `unmount: () => void`). Implement factory: lazy-import `ink` + `react`, set up mutable state ref, render `<InkStreamRenderer>`, wire processor events to state mutations + forceUpdate.

   **State bridge pattern:**

   ```text
   stateRef = { text: '', thinking: '', toolCalls: [], isStreaming: true }
   forceUpdateRef = { current: () => void }  // set from component useEffect

   // onText(delta): stateRef.text += delta; forceUpdateRef.current()
   // onThinking(delta): stateRef.thinking += delta; forceUpdateRef.current()
   // onToolCall(part): stateRef.toolCalls.push({...part, done: true}); forceUpdateRef.current()
   // onEnd(): stateRef.isStreaming = false; forceUpdateRef.current()
   ```

3. **Update `package.json`** — add `"./renderers/ink"` export; add `"ink": ">=4.0.0"` + `"react": ">=18.0.0"` to `peerDependencies` with optional metadata `{ "optional": true }`

4. **Update `tsup.config.ts`** — add `'src/renderers/ink/index.ts'` to entries array

5. **Update `src/renderers/index.ts`** — add `- **Ink** (\`./ink\`) — ...` to the JSDoc table

### Phase 2 — Core Components

1. **Create `src/renderers/ink/utils/tokenCache.ts`** — module-level `tokenCache = new Map<string, string>()` (LRU, max 500); `getCachedAnsi(content: string, render: (s: string) => string): string` — hash content as key, LRU-promotes on hit, evicts oldest on overflow.

2. **Create `src/renderers/ink/utils/markdownToAnsi.ts`** — `hasMarkdownSyntax(s: string): boolean` (regex fast-path, sample first 500 chars); `markdownToAnsi(content: string, highlight?: boolean): string` — lazy-imports `cli-markdown`, calls `cachedRender(content)` using tokenCache; falls back to plain text if import fails.

3. **Create `src/renderers/ink/components/StreamingText.tsx`** — `StreamingText({ text, markdown, isStreaming })`. Implements stable-prefix optimization: `stablePrefixRef = useRef('')`, on each render scan backwards from end for last `\n\n` block boundary; stable prefix is memoized (only re-renders if it changes), unstable suffix always re-renders. Renders `<Box flexDirection="column">` with `<Text>{ansiContent}</Text>` where ansiContent is ANSI-formatted via `markdownToAnsi`. Shows streaming cursor `▌` appended to last line when `isStreaming=true`.

4. **Create `src/renderers/ink/components/ThinkingBlock.tsx`** — `ThinkingBlock({ text, style, isStreaming })`. When `style === 'blockquote'`: renders `<Box borderLeft="│" paddingLeft={1}><Text dimColor>{text}</Text></Box>` (border emulated with left-padded `│` prefix using `<Text color="gray">│ </Text>`). When `style === 'inline'`: renders `<Text italic dimColor>[Thinking] {text}</Text>`. When `style === 'suppress'`: returns `null`. Shows `⠋ thinking…` spinner via `useAnimation` with braille spinner frames while `isStreaming`.

5. **Create `src/renderers/ink/components/ToolCallBlock.tsx`** — `ToolCallBlock({ call: { name, id, arguments, done } })`. When `done === false`: renders `<Text color="yellow">{spinnerFrame} {name}(…)</Text>` with animated spinner via `useAnimation`. When `done === true`: renders `<Text color="green">✓ {name}</Text>`. Both states use `<Box marginBottom={1}>`.

6. **Create `src/renderers/ink/InkStreamRenderer.tsx`** — `InkStreamRenderer({ stateRef, forceUpdateRef, options })`. Uses `useState(0)` as tick counter. `useEffect(() => { forceUpdateRef.current = () => setTick(t => t + 1) }, [])`. Reads `stateRef.current` on each render tick. Renders `<Box flexDirection="column">` containing conditional `<ThinkingBlock>`, `toolCalls.map(tc => <ToolCallBlock key={id}>)`, `<StreamingText>`. Does NOT use `<Static>` — this renderer owns a single streaming turn, not a multi-turn conversation history.

### Phase 3 — Tests

1. **Create `src/renderers/ink/ink.test.ts`** — vitest tests:
   - `renderToString(<InkStreamRenderer ...>)` for static output verification
   - Feed chunks one-by-one, assert accumulated text rendered
   - `thinkingStyle: 'blockquote'` — thinking appears with `│` prefix
   - `thinkingStyle: 'suppress'` — thinking hidden
   - `showToolCalls: true` — tool call name visible
   - `markdown: false` — raw text, no ANSI formatting
   - `end()` removes streaming cursor
   - Empty write sequence doesn't crash

### Phase 4 — Integration & Verification

1. Run `task check-types` — fix any type errors
2. Run `task unit-tests` — all tests pass
3. Manual smoke test: write a small ad-hoc script that creates a renderer, feeds a markdown stream through it, and verifies terminal output visually

---

## Type Signatures (key interfaces)

```typescript
// InkRendererOptions
interface InkRendererOptions extends BaseRendererOptions {
  thinkingStyle?: 'blockquote' | 'inline' | 'suppress'; // default: 'blockquote'
  showToolCalls?: boolean; // default: true
  markdown?: boolean; // default: true
  inkOptions?: Partial<RenderOptions>; // passed to ink.render()
}

// InkRendererHandle
interface InkRendererHandle extends RendererHandle {
  instance: Instance; // ink Instance for rerender()/clear()/unmount()
  unmount: () => void; // convenience alias for instance.unmount()
}
```

---

## Decisions

- **No `<Static>`** — this renderer represents a single streaming turn; callers compose multiple turns themselves
- **Lazy peer dep imports** — `ink` and `react` loaded via dynamic import in factory, matching cli-markdown pattern in cli renderer; clear error thrown if missing
- **cli-markdown for ANSI** — reuses existing peer dep; no new markdown dep introduced. Future: could swap for `marked` + chalk for more control
- **No `src/ui/` conversation store** — event-sourced store is for multi-turn; simple mutable ref is sufficient for single-turn streaming
- **`useAnimation` for spinners** — uses Ink's built-in animation hook; avoids manual setInterval
- **Stable-prefix only on streaming** — when `isStreaming=false`, render the full content from cache in one pass
- **No theming** — unlike Claude Code's ThemeProvider, we use hardcoded chalk/ANSI colors; theming can be added later via InkRendererOptions
- **CJS output** — tsup produces both ESM and CJS; React/Ink are ESM-first but our build handles the shim

## Out of Scope

- Multi-turn conversation history / `<Static>` items
- Keyboard input / interactive mode
- Screen reader layout
- Syntax highlighting (deferred — can add `cli-highlight` or shiki later)
- Theme system
