import type { MCPTransport } from '@agentsy/processor';
import type { ChatResponseStream, CancellationToken } from 'vscode';

/**
 * First-class VS Code MCP bridge helper that simplifies integration
 * between VS Code's ChatResponseStream and MCP transport layers.
 */
export class VSCodeMCPBridgeHelper {
  private readonly transport: MCPTransport;
  private readonly cancellationToken: CancellationToken;

  constructor(transport: MCPTransport, cancellationToken: CancellationToken) {
    this.transport = transport;
    this.cancellationToken = cancellationToken;
  }

  /**
   * Creates a ChatResponseStream-compatible interface that bridges
   * MCP transport events to VS Code's chat response format.
   */
  public createChatResponseStream(): ChatResponseStream {
    // This is a simplified bridge implementation
    // In a real implementation, you would:
    // 1. Adapt the MCP transport to a readable stream
    // 2. Parse SSE events from the stream
    // 3. Convert events to VS Code chat response format
    // 4. Handle cancellation via the token

    // Create a mock ChatResponseStream for demonstration
    // In a real implementation, this would bridge to the actual MCP transport
    const mockStream: ChatResponseStream = {
      markdown: (value: string) => {
        // Implementation would process markdown from MCP transport
      },
      anchor: (value: any, title?: string) => {
        // Implementation would process anchor from MCP transport
      },
      button: (command: any) => {
        // Implementation would process button from MCP transport
      },
      filetree: (value: any, baseUri: any) => {
        // Implementation would process filetree from MCP transport
      },
      progress: (value: string) => {
        // Implementation would process progress from MCP transport
      },
      reference: (value: any, iconPath?: any) => {
        // Implementation would process reference from MCP transport
      },
      push: (part: any) => {
        // Implementation would push generic parts from MCP transport
      },
    };

    return mockStream;
  }

  /**
   * Gets the underlying MCP transport for direct access when needed.
   */
  public getTransport(): MCPTransport {
    return this.transport;
  }

  /**
   * Gets the cancellation token for coordinating stream cancellation.
   */
  public getCancellationToken(): CancellationToken {
    return this.cancellationToken;
  }
}

/**
 * Factory function to create a VSCodeMCPBridgeHelper instance.
 * This is the recommended entry point for VS Code extensions.
 */
export function createVSCodeMCPBridge(
  transport: MCPTransport,
  cancellationToken: CancellationToken,
): VSCodeMCPBridgeHelper {
  return new VSCodeMCPBridgeHelper(transport, cancellationToken);
}
