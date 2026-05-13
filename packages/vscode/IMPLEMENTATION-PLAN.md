# @agentsy/vscode — Implementation Plan

## Role in Framework Ecosystem

`@agentsy/vscode` is the **flagship surface** of the framework. It is the only currently published package and provides the bridge between the VS Code Language Model API and the core Agentsy stream processing pipeline. It allows developers to use Agentsy-powered agents directly within their favorite editor.

It consumes `@agentsy/core`, `@agentsy/runtime`, and `@agentsy/types`.

### Ecosystem Sketch

```text
[ VS Code Chat / Copilot ]
           |
           v
[ @agentsy/vscode ] <--- Bridge & UI
           |
    +------+------+
    |             |
    v             v
[ @agentsy/core ] [ @agentsy/runtime ]
(Stream Parsing)  (Agent Management)
```

## Fulfillment of Role

The package fulfills its role by implementing a VS Code Language Model Chat Provider:

1. **Stream Bridge**: Converting VS Code's `LanguageModelResponse` into Agentsy's `NormalizedChunk` stream.
2. **MCP Integration**: Stabilizing `vscodeBridgeHelper.ts` to support Model Context Protocol over VS Code transports.
3. **Secret Storage**: Using VS Code's `SecretStorage` to securely manage user API keys.
4. **Status Indicators**: Using `StatusBarItem` to show active agent state and token usage.

## Detailed Functionality

### 1. The Provider Bridge (`src/bridge/`)

- **Responsibility**: Data transformation.
- **Mechanism**: `adaptStream` utility.
- **Key Logic**: Handles the `ReadableStream` type mismatch between Node.js and the VS Code DOM library using explicit casts.

### 2. Chat Participant (`src/participant/`)

- **Mechanism**: `createChatParticipant`.
- **Functionality**: Defines how the agent appears in the Chat view, handling user queries and providing real-time feedback.

### 3. UI Surfaces (`src/ui/`)

- **Responsibility**: User experience.
- **Functionality**: Manages the status bar, settings panels, and any custom webviews used for observability or memory management.

## Logic & Data Flow

### 1. The Interaction Flow

1. User sends a message in VS Code Chat.
2. VS Code calls the Agentsy `ChatParticipant`.
3. The participant initializes a runtime loop using `@agentsy/runtime`.
4. The loop makes a request to the VS Code Language Model API.
5. The resulting stream is piped through the Agentsy bridge to `@agentsy/core` for parsing and tool detection.
6. Progress and results are streamed back to the VS Code Chat UI.

## Key Interfaces

### VSCodeBridge

```typescript
export interface VSCodeBridge {
  adaptStream(vsStream: vscode.LanguageModelResponseStream): ReadableStream<NormalizedChunk>;
  handleMCPRequest(request: MCPRequest): Promise<MCPResponse>;
}
```

## Implementation Details

### Type Casts

Due to the DOM/Node `ReadableStream` incompatibility, explicit casts to `as ReadableStream<string>` are required at the bridge boundary. This is a known VS Code extension environment constraint.

### Dependency Note

`MCPTransport` must be imported from `@agentsy/core/processor` to ensure compatibility with the extension's module resolution.

## Sources Synthesized

`handoff-phase-c-scripts-migration.md`, `alignment-report-5-11-26.md`, `agentsy-tech.md`, `research/IDE-TOOLS-ANALYSIS.md`, `packages/vscode/IMPLEMENTATION-PLAN.md`.
