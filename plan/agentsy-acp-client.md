# Plan: Agent Client Protocol Support for Agentsy

## 1. Background Analysis

### Reviewed Resources Summary

- **Agent Client Protocol introduction and overview**
  Describes ACP as the protocol between editors/IDEs and coding agents, suitable for both local subprocess agents and remote hosted agents.

- **Protocol lifecycle guidance**
  Focuses on initialization, authentication, session creation/loading, prompt turns, progress notifications, cancellation, and tool-mediated file/terminal actions.

- **Platform integration patterns**
  Shows ACP as an editor-facing control surface where the client owns user interaction, permissions, and workspace access.

### Key Takeaways

- ACP client is not a generic chat API.
- It is a **session-based control protocol** for editor-to-agent interaction.
- Local and remote transports should be supported through the same logical client API.
- Permission boundaries must be explicit because file and terminal operations are privileged actions.
- The protocol should preserve a clean separation between UI, transport, and agent runtime state.

---

## 2. Requirements for Agentsy ACP Client Support

Based on the reviewed ACP client material and the current Agentsy architecture, we need:

- **Session lifecycle management**: initialize, authenticate, new session, load session, prompt turn, cancel.
- **Transport flexibility**: stdio/JSON-RPC for local agents, HTTP/WebSocket for remote agents.
- **Workspace operations**: file reads, file writes, and terminal execution requests routed through gated permissions.
- **Streaming progress**: support updates during long-running agent turns.
- **Capability negotiation**: version and feature handshake before session work begins.
- **Deterministic state handling**: predictable client state suitable for retries, cancellation, and resumed sessions.
- **Editor integration**: adapters for VS Code and any future editor surfaces without hard-coding UI logic into the protocol layer.
- **Security and control**: explicit allowlists, prompt approvals, and cancellation semantics.

---

## 3. Proposed Architecture

### 3.1 New Package: `@agentsy/acp-client`

Create a package dedicated to the editor/client side of ACP:

- **Core Abstractions**:
  - `ACPClientSession`
  - `ACPClientTransport`
  - `ACPClientCapabilities`
  - `ACPClientEvent`
  - `ACPClientRequest`
  - `ACPClientResponse`
  - `ACPPermissionRequest`

- **Primary Responsibilities**:
  - manage session state
  - route client-to-agent requests
  - receive agent-to-client notifications
  - normalize protocol messages into typed events
  - enforce client-side permissions for workspace operations
  - support cancellation and resumption
  - expose a transport-neutral API for editor integrations

### 3.2 Transport Model

- **Local transport**
  - JSON-RPC over stdio
  - used for subprocess-based agents

- **Remote transport**
  - HTTP for hosted agents
  - WebSocket for bidirectional streaming where needed

- **Transport adapter contract**
  - initialize connection
  - negotiate capabilities
  - send requests
  - receive notifications
  - cancel active turns

### 3.3 Session Model

- Sessions should track:
  - session id
  - active agent identity
  - client capabilities
  - permission state
  - current turn state
  - cancellation token
  - workspace scope

- Session state must be serializable so it can be resumed or inspected.

### 3.4 Permission Model

- Agent requests for file and terminal access must be explicit.
- Client should mediate:
  - read requests
  - write requests
  - shell execution
  - approval prompts
  - cancellation

---

## 4. Implementation Plan

### Phase 1: Shared contracts

1. Define ACP client types in `packages/types` or a shared protocol-core layer if needed.
2. Create request/response/event schemas for initialize, authenticate, session lifecycle, and progress events.
3. Add validation helpers and tests for protocol payloads.

### Phase 2: Client transport layer

1. Implement stdio transport for local agent subprocesses.
2. Implement HTTP and WebSocket transport adapters for remote agents.
3. Add timeout, retry, and cancellation handling.
4. Normalize transport errors into ACP client errors.

### Phase 3: Session orchestration

1. Implement session creation, loading, and teardown.
2. Track prompt turns and progress notifications.
3. Support cancellation and partial result recovery.
4. Add tests for lifecycle transitions and state serialization.

### Phase 4: Workspace operations and permissions

1. Implement file operation request handling.
2. Implement terminal operation request handling.
3. Add permission gating and approval prompts.
4. Add tests for allowlist and denylist behavior.

### Phase 5: Editor integrations

1. Add VS Code-facing adapters that consume the ACP client package.
2. Keep UI rendering outside the protocol layer.
3. Expose a clean integration surface for future editors.

---

## 5. Risk Mitigation & Best Practices

- Keep transport logic separate from UI state.
- Treat remote agents as untrusted until capabilities are negotiated.
- Avoid embedding editor-specific assumptions in the protocol core.
- Preserve deterministic session state for debugging and replay.
- Require explicit approval for privileged workspace actions.

---

## 6. Summary

`@agentsy/acp-client` should provide the editor-side control plane for agent sessions. It will handle initialization, authentication, sessions, streaming updates, cancellation, and gated workspace actions while remaining transport-neutral and UI-agnostic.

This keeps ACP client support aligned with Agentsy’s existing layered architecture and makes it possible to support both local subprocess agents and remote hosted agents cleanly.
