/**
 * MCP Tool definition for tool invocation
 */
export interface McpTool {
  name: string;
  description: string;
  inputSchema?: object;
  handler: (input: any) => Promise<any>;
}

/**
 * MCP Resource definition for data access
 */
export interface McpResource {
  uri: string;
  name: string;
  description: string;
  mimeType?: string;
}

/**
 * MCP Prompt template for structured prompts
 */
export interface McpPrompt {
  name: string;
  description: string;
  arguments?: Record<string, string>;
}

/**
 * MCP Server configuration
 */
export interface McpServerConfig {
  name: string;
  version?: string;
  tools?: McpTool[];
  resources?: McpResource[];
  prompts?: McpPrompt[];
  capabilities?: McpCapabilities;
}

/**
 * MCP Server capabilities
 */
export interface McpCapabilities {
  tools?: boolean;
  resources?: boolean;
  prompts?: boolean;
  streaming?: boolean;
}

/**
 * MCP Tool invocation parameters
 */
export interface McpToolInvocation {
  toolName: string;
  arguments?: Record<string, any>;
}

/**
 * MCP Tool result
 */
export interface McpToolResult {
  content: string;
  isError?: boolean;
  metadata?: Record<string, any>;
}

/**
 * MCP Resource read result
 */
export interface McpResourceResult {
  contents: string;
  mimeType?: string;
  uri: string;
}
