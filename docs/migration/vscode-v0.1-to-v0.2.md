# @agentsy/vscode migration from v0.1.x to 0.2.x

This guide outlines the major changes and migration steps when upgrading Agentsy's `@agentsy/vscode` package from version 0.1.x to 0.2.x.

## Breaking Changes

- The package structure has been refactored into multiple submodules with independent exports.
- New subpath exports added for: `renderer`, `mcp`, `mcp-integration`, `retry`, `stream-bridge`, `vscode-overloads`, `api-key-manager`, `settings`, `error-handling`, `testing`.
- API methods related to MCP streaming and VS Code chat rendering have been introduced or renamed.

## Migration Steps

1. Update your imports to use the new subpath exports, for example:

```ts

```

- import { createVSCodeChatRenderer } from '@agentsy/vscode';

```
+ import { createVSCodeChatRenderer } from '@agentsy/vscode/renderer';
```

2. Adopt new streaming bridge and retry utilities for better resilience.

3. Adjust code to use new agent loop creation methods from `@agentsy/vscode`.

4. Update your dependency version to `^0.2.0` or later.

## Decision Tree

- If you use chat streaming with MCPTransport, switch to `createMCPChatBridge`.
- If you use cancellation tokens with MCP streaming, use `createVSCodeMCPBridge` helper.
- For robust retry logic, integrate `createRetryUtility`.

For more detailed API usage, please see the updated documentation at <https://agentsy.com/docs/packages/vscode>

---

This migration guide will be updated with additional details as the v0.2.0 release matures.
