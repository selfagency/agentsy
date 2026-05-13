# @agentsy/renderers — Implementation Plan

## Role in Framework Ecosystem

`@agentsy/renderers` is the **visual engine** of the framework. It decouples the core logic of agent loops and stream processing from the specific details of how that information is displayed to a human. Whether the output is destined for a raw terminal, a rich TUI, or an integrated editor like VS Code, this package provides the necessary adapters.

It is consumed by `@agentsy/cli`, `@agentsy/vscode`, and any other interactive surface that needs to show agent progress.

### Ecosystem Sketch

```text
[ @agentsy/cli ]    [ @agentsy/vscode ]    [ Custom App ]
         |                |                    |
         +--------+-------+----------+---------+
                  |
                  v
         [ @agentsy/renderers ] <--- Output Adaptation
                  |
         +-----------------------+-----------------------+
         |                       |                       |
         v                       v                       v
 [ CLI Renderer ]        [ TUI Renderer ]        [ VS Code Bridge ]
 (ANSI / Markdown)       (Panes / Status)        (Chat API)
```

## Fulfillment of Role

The package fulfills its role by providing:

1. **Unified Renderer API**: A single interface for consuming streams of text, thoughts, and tool calls.
2. **Pluggable Adapters**: Specialized logic for different target environments.
3. **Rich Component Rendering**: Standardized ways to display complex objects like tool call results or reasoning "thinking" blocks.
4. **ANSI & Markdown Support**: Robust handling of terminal formatting and rich-text conversion.

## Detailed Functionality

### 1. Target Adapters (`src/adapters/`)

- **CLI Adapter**: Optimized for standard terminal output. Supports color (chalk), spinners (ora), and progress bars.
- **TUI Adapter**: Uses libraries like `ink` or `blessed` to provide a pane-based interface with scrolling and status bars.
- **Plain Text**: A minimal renderer that strips all formatting, useful for log files and non-interactive contexts.

### 2. Component Rendering (`src/components/`)

- **Thinking Blocks**: Logic to render `<think>` tags with a specialized style (e.g., dimmed text or an expandable section).
- **Tool Calls**: Visualizing active tool execution, showing arguments and results in a structured format.
- **Streaming Logic**: Implements a smooth "typing" effect for LLM output, preventing jerky UI updates.

### 3. Themes & Styling (`src/themes/`)

- **Responsibility**: Aesthetic consistency.
- **Functionality**: Defines color palettes and iconography for different agent states (e.g., green for success, red for error).

## Logic & Data Flow

### 1. The Rendering Loop

1. `@agentsy/cli` (or another consumer) initializes a `Renderer` (e.g., `TerminalRenderer`).
2. As chunks arrive from `@agentsy/core`, the consumer calls `renderer.onChunk(chunk)`.
3. The renderer determines the content type (Text, Thought, Tool) and applies the appropriate transformation.
4. The transformed output is buffered and then flushed to the target surface (e.g., `process.stdout`).

### 2. Event Rendering

1. When a framework event occurs (e.g., `tool_call_started`), the consumer calls `renderer.onEvent(event)`.
2. The renderer displays the event status (e.g., showing a spinner while a tool is running).

## Key Interfaces

### Renderer

```typescript
export interface Renderer {
  onChunk(chunk: NormalizedChunk): void;
  onEvent(event: FrameworkEvent): void;
  clear(): void;
  flush(): void;
}
```

### Formatting Options

```typescript
export interface RendererOptions {
  theme: 'dark' | 'light' | 'mono';
  color: boolean;
  verbosity: 'quiet' | 'normal' | 'verbose';
  typingSpeed: number; // ms per chunk
}
```

## Implementation Details

### Streaming Correctness

The renderer must be able to handle "interleaved" content safely—for example, when a tool result arrives while the LLM is still generating text.

### VS Code Integration

The VS Code adapter should map framework events to the VS Code Chat API's `ResponseStream`, ensuring that Agentsy agents look and feel like native VS Code participants.

---

## Standalone Renderers Expansion (migrated from `plan/agentsy-standalone-v1.md`)

### Package boundary and export requirements

- Keep `@agentsy/renderers` standalone: no imports from orchestration packages.
- Maintain subpath exports for tree-shaking: `plain`, `cli`, `vscode`, `browser`, `ink`.
- Keep `vscode` renderer duck-typed (no direct `import 'vscode'` in renderers package).
- Expose shared renderer types and `DisplayPort` from top-level package.
- Treat renderer API surface (`RendererHandle`, `BaseRendererOptions`, `ThinkingStyle`, `DisplayPort`) as semver-major on breaking changes.

### DisplayPort evolution

- `DisplayPort.write(content): Promise<void>` remains async for backpressure.
- Browser renderer should accept either `DisplayPort` or `HTMLElement` target.
- Support future GUI bridges (Electron/Tauri/Webview/WebSocket) via thin `DisplayPort` adapters.

### Ink component roadmap (interactive suite)

- Existing/future interactive components must gate key handling with `isFocused`.
- Composite components must implement internal single-focus routing.
- Controlled component pattern for editor/selectors (`value` + `onChange`/`onSelect`).
- Planned exports include: `DiffViewer`, `WorktreeBrowser`, `TextEditor`, `TerminalPane` (+ fallback), `FileBrowser`, `ChatHistory`, `Chat`, `AgentSelector`, `ModelSelector`, `ModelParamEditor`, `SkillSelector`, `MCPServerManager`, `ContextPicker`, `TokenUsageMeter`.

### Security additions

- Remote display adapters sanitize output before emission.
- WebView targets require DOM sanitization (no raw `innerHTML`).
- `TerminalPane` command spawn config must be static (no untrusted command interpolation).
- Symbol search subprocess calls must use literal arg arrays with `shell: false`.

### Future extension compatibility

- Architecture should remain composable for a thin VS Code extension package and a desktop app package without introducing new core streaming primitives.

## Sources Synthesized

`agentsy-standalone-v1.md`, `agentsy-tech.md`, `agentsy-features-v1.md`, `docs/packages/renderers.md`, `packages/renderers/IMPLEMENTATION-PLAN.md`.

---

## Extracted Technical API Surface (from `plan/agentsy-tech.md`)

### Renderer/platform responsibilities

- Keep `DisplayPort` as the platform extension seam for CLI/editor/browser/desktop targets.
- Preserve duck-typed VS Code renderer contract (no direct vscode dependency in renderers package).
- Keep AG-UI protocol adaptation out of renderers package; runtime remains canonical AG-UI owner.

### Subpath responsibilities retained

- `plain`: zero peer deps
- `cli`: terminal-focused formatting
- `ink`: interactive terminal components
- `vscode`: bridge renderer using duck-typed surface contracts
- `browser`: sanitized DOM-target rendering contracts
