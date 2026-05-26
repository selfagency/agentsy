/**
 * MCP Tool definition for tool invocation
 */
export interface McpTool {
  description: string;
  handler: (input: unknown) => Promise<unknown>;
  inputSchema?: Record<string, unknown>;
  name: string;
}

/**
 * MCP Resource definition for data access
 */
export interface McpResource {
  description: string;
  mimeType?: string;
  name: string;
  uri: string;
}

/**
 * MCP Prompt template for structured prompts
 */
export interface McpPrompt {
  arguments?: Record<string, string>;
  description: string;
  name: string;
}

/**
 * MCP Server configuration
 */
export interface McpServerConfig {
  capabilities?: McpCapabilities;
  name: string;
  prompts?: McpPrompt[];
  resources?: McpResource[];
  tools?: McpTool[];
  version?: string;
}

/**
 * MCP Server capabilities
 */
export interface McpCapabilities {
  prompts?: boolean;
  resources?: boolean;
  streaming?: boolean;
  tools?: boolean;
}

/**
 * MCP Tool invocation parameters
 */
export interface McpToolInvocation {
  arguments?: Record<string, unknown>;
  toolName: string;
}

/**
 * MCP Tool result
 */
export interface McpToolResult {
  content: string;
  isError?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * MCP Resource read result
 */
export interface McpResourceResult {
  contents: string;
  mimeType?: string;
  uri: string;
}
