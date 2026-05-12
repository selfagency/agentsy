# Package ecosystem

This page explains how the current packages relate to each other.

## Layered view

### 1. Foundation utilities

These packages solve narrow parsing or shaping problems and can be used independently:

- `@agentsy/sse`
- `@agentsy/thinking`
- `@agentsy/tool-calls`
- `@agentsy/structured`
- `@agentsy/context`
- `@agentsy/xml-filter`
- `@agentsy/formatting`
- `@agentsy/recovery`
- `@agentsy/types`

### 2. Shared stream language

`@agentsy/normalizers` converts provider-specific formats into the common event vocabulary expected by the rest of the stack.

### 3. Processing engine

`@agentsy/processor` orchestrates the incremental flow and exposes transforms for smoothing, thinking filtering, and tool-call filtering.

### 4. State and presentation

- `@agentsy/renderers` turns events into text-oriented output.
- `@agentsy/ui` projects events into conversation state.
- `@agentsy/ag-ui` adapts the model to AG-UI protocol expectations.

### 5. Runtime and integration surfaces

- `@agentsy/orchestrator/agent` builds higher-level loops.
- `@agentsy/adapters` packages common integration logic.
- `@agentsy/vscode` provides the current published editor-focused integration layer.

## Example composition patterns

### Minimal streaming pipeline

Use `@agentsy/normalizers` plus `@agentsy/processor` when you only need to normalize and process provider output.

### Structured-output workflow

Add `@agentsy/structured` and `@agentsy/tool-calls` when your application needs schema handling or tool invocation.

### Agent application

Add `@agentsy/orchestrator/agent`, then choose one or more projection layers:

- `@agentsy/renderers` for textual output
- `@agentsy/ui` for app state
- `@agentsy/vscode` for VS Code integration

## Package boundaries to preserve

- Do not move VS Code concepts into lower-level parsing packages.
- Do not document planned runtime packages as if they already sit between the current layers.
- Treat package-local `src/index.ts` barrels as the source of truth for current documented API.
