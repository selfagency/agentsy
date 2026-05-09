import type { ChatResponseStream, CancellationToken } from 'vscode';
import { VSCodeMCPBridgeHelper } from '../mcp/vscodeBridgeHelper.js';
import type { MCPTransport } from '@agentsy/processor';

/**
 * MCPChatBridge bridges an MCP transport to VS Code's ChatResponseStream.
 * Use this when you have an MCPTransport and need a ChatResponseStream for VS Code chat handlers.
 */
export class MCPChatBridge {
  private readonly helper: VSCodeMCPBridgeHelper;
  private readonly cancellationToken: CancellationToken;

  constructor(transport: MCPTransport, cancellationToken: CancellationToken) {
    this.helper = new VSCodeMCPBridgeHelper(transport, cancellationToken);
    this.cancellationToken = cancellationToken;
  }

  /**
   * Creates a ChatResponseStream that bridges MCP transport events to VS Code's chat interface.
   * This is the canonical documented path for VS Code extensions.
   * Creates a new stream and connects the MCP transport to it.
   */
  public createStream(): ChatResponseStream {
    const targetStream = this.helper.createDirectChatResponseStream();
    return targetStream;
  }

  /**
   * Gets the underlying MCP transport for direct access when needed.
   */
  public getTransport(): MCPTransport {
    return this.helper.getTransport();
  }

  /**
   * Gets the cancellation token for coordinating stream cancellation.
   */
  public getCancellationToken(): CancellationToken {
    return this.helper.getCancellationToken();
  }
}

/**
 * Factory that creates an MCPChatBridge for the given transport and cancellation token.
 */
export function createMCPChatBridge(transport: MCPTransport, cancellationToken: CancellationToken): MCPChatBridge {
  return new MCPChatBridge(transport, cancellationToken);
}
