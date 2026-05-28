/**
 * MCP server registry events.
 */
export type McpServerEvent = 'registered' | 'unregistered' | 'updated';

/**
 * MCP server event listener.
 */
export type McpServerEventListener = (event: McpServerEvent, server: unknown) => void;

/**
 * MCP server configuration options.
 */
export interface McpServerOptions {
  /** Enable automatic startup */
  autoStart?: boolean;

  /** Retry configuration */
  retries?: {
    maxAttempts: number;
    backoffMs: number;
  };

  /** Timeout for server startup in milliseconds */
  startupTimeout?: number;
}
