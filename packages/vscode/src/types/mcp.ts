import type { McpServerDefinition, McpServerProvider } from './errors.js';

/**
 * MCP server registry events.
 */
export type McpServerEvent = 'registered' | 'unregistered' | 'updated';

/**
 * MCP server event listener.
 */
export type McpServerEventListener = (
  event: McpServerEvent,
  server: McpServerDefinition,
) => void;

/**
 * Re-export for convenience.
 */
export type { McpServerDefinition, McpServerProvider };

/**
 * MCP server configuration options.
 */
export interface McpServerOptions {
  /** Enable automatic startup */
  autoStart?: boolean;

  /** Timeout for server startup in milliseconds */
  startupTimeout?: number;

  /** Retry configuration */
  retries?: {
    maxAttempts: number;
    backoffMs: number;
  };
}
