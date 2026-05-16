# @agentsy/mcp

Model Context Protocol integration for LLM tool invocation and resource discovery. Implements the MCP 2025-06-18 specification with standardized transports and capability negotiation.

## Installation

```bash
pnpm add @agentsy/mcp
```

## Usage

### Server Configuration

```typescript
import type { McpServerConfig, McpServer } from "@agentsy/mcp";

const serverConfig: McpServerConfig = {
  name: "my-mcp-server",
  version: "1.0.0",
  tools: [
    {
      name: "summarize",
      description: "Summarizes the provided text",
      inputSchema: {
        type: "object",
        properties: {
          text: { type: "string" },
        },
      },
    },
  ],
  resources: [
    {
      uri: "file:///data/documents/summary",
      name: "Document summaries",
      description: "Cached document summaries",
    },
  ],
  prompts: [
    {
      name: "code-review",
      description: "Prompt template for code review",
      arguments: {
        language: "typescript",
        focus: "security",
      },
    },
  ],
  capabilities: {
    tools: true,
    resources: true,
    prompts: true,
    streaming: true,
  },
};
```

### Tool Invocation

```typescript
import type { McpToolInvocation, McpToolResult } from "@agentsy/mcp";

async function invokeTool(
  invocation: McpToolInvocation
): Promise<McpToolResult> {
  // Invokes tool with server tools and returns result
  const result = await mcpServer.invokeTool(
    invocation.toolName,
    invocation.arguments
  );
  return result;
}
```

### Resource Access

```typescript
import type { McpResourceResult } from "@agentsy/mcp";

async function readResource(uri: string): Promise<McpResourceResult> {
  // Reads resource from server and returns content with MIME type
  const result = await mcpServer.readResource(uri);
  return result;
}
```

## Interfaces

### `McpTool`

```typescript
interface McpTool {
  name: string;
  description: string;
  inputSchema?: object;
  handler: (input: any) => Promise<any>;
}
```

### `McpResource`

```typescript
interface McpResource {
  uri: string;
  name: string;
  description: string;
  mimeType?: string;
}
```

### `McpPrompt`

```typescript
interface McpPrompt {
  name: string;
  description: string;
  arguments?: Record<string, string>;
}
```

### `McpServerConfig`

```typescript
interface McpServerConfig {
  name: string;
  version?: string;
  tools?: McpTool[];
  resources?: McpResource[];
  prompts?: McpPrompt[];
  capabilities?: McpCapabilities;
}
```

### `McpCapabilities`

```typescript
interface McpCapabilities {
  tools?: boolean;
  resources?: boolean;
  prompts?: boolean;
  streaming?: boolean;
}
```

### `McpToolInvocation`

```typescript
interface McpToolInvocation {
  toolName: string;
  arguments?: Record<string, any>;
}
```

### `McpToolResult`

```typescript
interface McpToolResult {
  content: string;
  isError?: boolean;
  metadata?: Record<string, any>;
}
```

### `McpResourceResult`

```typescript
interface McpResourceResult {
  contents: string;
  mimeType?: string;
  uri: string;
}
```

## Role in Framework Ecosystem

The `@agentsy/mcp` package serves as the standardization bridge in the Agentsy framework:

- Runtime tool execution (`@agentsy/runtime`)
- VS Code local server management (`@agentsy/vscode`)
- CLI local server management (`@agentsy/cli`)

## Dependencies

- `@agentsy/types` - Shared type contracts

## License

[MIT](LICENSE)
