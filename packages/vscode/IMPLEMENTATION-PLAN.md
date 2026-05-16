---
goal: @agentsy/vscode production implementation plan
version: 1.0
date_created: 2026-05-15
last_updated: 2026-05-15
owner: vscode-maintainers
status: In progress
tags: [feature, architecture, vscode, extension, parity]
---

# Introduction

![Status: In progress](https://img.shields.io/badge/status-In%20progress-yellow)

This plan defines the production implementation order for `@agentsy/vscode` as the flagship editor integration surface.

## 1. Requirements & Constraints

- **REQ-VSCODE-001**: Extension bridges framework streaming/runtime behavior into native VS Code chat/response surfaces.
- **REQ-VSCODE-002**: Command/settings/activation contracts are explicit and documented.
- **REQ-VSCODE-003**: Provider/model/session workflows maintain parity with CLI where applicable.
- **REQ-VSCODE-004**: Diagnostics and trace surfaces expose actionable runtime/tool/memory events.
- **SEC-VSCODE-001**: Extension-host and webview boundaries sanitize untrusted content.
- **SEC-VSCODE-002**: Secrets use VS Code secret storage plus `@agentsy/secrets` contracts.
- **CON-VSCODE-001**: Core streaming/normalization primitives remain in core/runtime packages.
- **CON-VSCODE-002**: Shared renderer integration stays duck-typed and decoupled.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-VSCODE-001: Contract and extension boundary stabilization.

| Task            | Description                                                                   | Completed | Date |
| --------------- | ----------------------------------------------------------------------------- | --------- | ---- |
| TASK-VSCODE-001 | Stabilize bridge interfaces for chat stream adaptation and response emission. |           |      |
| TASK-VSCODE-002 | Finalize extension command/settings/activation contract definitions.          |           |      |
| TASK-VSCODE-003 | Document package boundaries with core/runtime/renderers/secrets.              |           |      |

### Implementation Phase 2

- GOAL-VSCODE-002: Core extension capability completion.

| Task            | Description                                                             | Completed | Date |
| --------------- | ----------------------------------------------------------------------- | --------- | ---- |
| TASK-VSCODE-004 | Implement chat participant and bridge pathways for streaming responses. |           |      |
| TASK-VSCODE-005 | Implement status, settings, and operational diagnostics surfaces.       |           |      |
| TASK-VSCODE-006 | Implement secure secret/provider integration and setup workflows.       |           |      |

### Implementation Phase 3

- GOAL-VSCODE-003: Parity and integration validation.

| Task            | Description                                                                    | Completed | Date |
| --------------- | ------------------------------------------------------------------------------ | --------- | ---- |
| TASK-VSCODE-007 | Validate parity with CLI for core model/session/runtime operations.            |           |      |
| TASK-VSCODE-008 | Add integration tests for chat stream, tools, approvals, and trace inspection. |           |      |
| TASK-VSCODE-009 | Validate compatibility with supported VS Code versions and APIs.               |           |      |

### Implementation Phase 4

- GOAL-VSCODE-004: Hardening and release gates.

| Task            | Description                                                              | Completed | Date |
| --------------- | ------------------------------------------------------------------------ | --------- | ---- |
| TASK-VSCODE-010 | Add regressions for extension host failures and API compatibility drift. |           |      |
| TASK-VSCODE-011 | Align docs/changelog/release notes with shipped behavior.                |           |      |
| TASK-VSCODE-012 | Pass package and monorepo release gates.                                 |           |      |

## 3. Acceptance Criteria

- **ACC-VSCODE-001**: Extension bridge and command/settings contracts are stable and test-covered.
- **ACC-VSCODE-002**: CLI parity and runtime integration expectations are met.
- **ACC-VSCODE-003**: Release gates and compatibility checks pass.

## 4. Sources Synthesized

- `plan/MASTER-IMPLEMENTATION-PLAN.md`
- `plan/feature-cli-dogfood-production-order-1.md`
- `docs/packages/vscode.md`
- `packages/vscode/README.md`
- `packages/vscode/CHANGELOG.md`
- `packages/vscode/IMPLEMENTATION-PLAN.md`

## 5. Existing Package Deep-Dive (Preserved)

---

## @agentsy/vscode — Implementation Plan

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
  adaptStream(
    vsStream: vscode.LanguageModelResponseStream
  ): ReadableStream<NormalizedChunk>;
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
