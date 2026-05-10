import type { ReadableStream } from 'node:stream/web';
import { parseSSEStream } from '@agentsy/sse';
import type { MCPTransport } from '@agentsy/core/processor';
import { adaptTransportToStream } from '@agentsy/core/processor';
import type { ChatResponseStream, CancellationToken } from 'vscode';
import { Uri, ChatResponseProgressPart } from 'vscode';

/**
 * Extended MCP event types that can be emitted from the transport.
 * These map to MCP message types that should be converted to VS Code chat format.
 */
export interface MCPStreamEvent {
  type: 'markdown' | 'anchor' | 'button' | 'filetree' | 'progress' | 'reference' | 'push';
  data: unknown;
}

/**
 * Maps MCP message types to VS Code stream event types.
 */
function mapMcpToStreamEvent(mcpType: string): MCPStreamEvent['type'] | null {
  const mapping: Record<string, MCPStreamEvent['type']> = {
    content: 'markdown',
    anchor: 'anchor',
    button: 'button',
    filetree: 'filetree',
    progress: 'progress',
    reference: 'reference',
    push: 'push',
  };
  return mapping[mcpType] ?? null;
}

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
   * Creates a ChatResponseStream that bridges MCP transport to VS Code chat format.
   * Wraps the provided target stream and forwards MCP events to it.
   */
  public createChatResponseStream(target: ChatResponseStream): ChatResponseStream {
    const transportStream = adaptTransportToStream(this.transport);

    // Process raw stream chunks and forward to target stream
    void this.processRawStream(transportStream, target);

    return target;
  }

  /**
   * Creates a new ChatResponseStream that emits to the MCP transport.
   * This is useful when the caller wants a stream that sends data back through MCP.
   */
  public createDirectChatResponseStream(): ChatResponseStream {
    const chatStream: ChatResponseStream = {
      markdown: value => this.pushEvent({ type: 'markdown', data: { value } }),
      anchor: (value, title) => this.pushEvent({ type: 'anchor', data: { value: String(value), title } }),
      button: command =>
        this.pushEvent({
          type: 'button',
          data: { command: String(command) },
        }),
      filetree: (value, baseUri) =>
        this.pushEvent({
          type: 'filetree',
          data: { value, baseUri: String(baseUri) },
        }),
      progress: value => this.pushEvent({ type: 'progress', data: { value } }),
      reference: (value, iconPath) =>
        this.pushEvent({
          type: 'reference',
          data: {
            value: String(value),
            iconPath: iconPath ? String(iconPath) : undefined,
          },
        }),
      push: part => this.pushEvent({ type: 'push', data: part }),
    };

    return chatStream;
  }

  /**
   * Connects the MCP transport to an existing ChatResponseStream.
   * This is the recommended pattern: pass in your VS Code ChatResponseStream
   * and this method will populate it with data from the MCP transport.
   */
  public connectToStream(stream: ChatResponseStream): void {
    const transportStream = adaptTransportToStream(this.transport);
    void this.processRawStream(transportStream, stream);
  }

  /**
   * Processes raw string chunks from the transport and forwards them to the chat stream.
   */
  private async processRawStream(
    transportStream: ReadableStream<string>,
    chatStream: ChatResponseStream,
  ): Promise<void> {
    const reader = transportStream.getReader();

    try {
      // Check for cancellation - handle gracefully
      if (this.cancellationToken.isCancellationRequested) {
        await reader.cancel();
        return;
      }

      // Use the robust SSE parser from @agentsy/sse
      for await (const sseEvent of parseSSEStream(transportStream)) {
        // Check for cancellation - handle gracefully
        if (this.cancellationToken.isCancellationRequested) {
          await reader.cancel();
          return;
        }

        // Map SSE event to MCP event type and handle
        const mappedType = mapMcpToStreamEvent(sseEvent.event || 'content');
        if (mappedType) {
          const event: MCPStreamEvent = {
            type: mappedType,
            data: sseEvent.data ? JSON.parse(sseEvent.data) : null,
          };
          this.handleEvent(event, chatStream);
        }
      }
    } catch (error) {
      // Handle stream errors gracefully - don't propagate to caller
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Error processing MCP stream:', error);
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Handles an MCP event by calling the appropriate ChatResponseStream method.
   * Uses minimal type assertions to work with VS Code's strict type system.
   */
  private handleEvent(event: MCPStreamEvent, chatStream: ChatResponseStream): void {
    const data = event.data as Record<string, unknown>;
    const content = typeof data.value === 'string' ? data.value : '';

    switch (event.type) {
      case 'markdown':
        chatStream.markdown(content);
        break;
      case 'progress':
        chatStream.progress?.(content);
        break;
      case 'anchor': {
        // Anchor expects specific VS Code Uri | Location types - use basic string conversion
        if (typeof data.anchorData === 'string' && typeof data.title === 'string') {
          chatStream.anchor(Uri.parse(data.anchorData), data.title);
        }
        break;
      }
      case 'button': {
        const commandStr = typeof data.command === 'string' ? data.command : '';
        const titleStr = typeof data.title === 'string' ? data.title : '';
        chatStream.button({ command: commandStr, title: titleStr });
        break;
      }
      case 'filetree': {
        // Filetree expects specific tree structure - minimal implementation with empty tree
        chatStream.filetree?.([], Uri.file('/'));
        break;
      }
      case 'reference': {
        const uriStr = typeof data.uri === 'string' ? data.uri : '';
        chatStream.reference(Uri.parse(uriStr));
        break;
      }
      case 'push':
        chatStream.push?.(new ChatResponseProgressPart('')); // Minimal ChatResponsePart implementation
        break;
    }
  }

  /**
   * Pushes an event to the MCP transport if a writable stream is available.
   * Used for two-way communication.
   */
  private pushEvent(event: MCPStreamEvent): void {
    // If transport has writable stream, send event back
    if (this.transport.type === 'stdio' && this.transport.writable) {
      const eventData = JSON.stringify(event);
      this.transport.writable.write(`${eventData}\n`);
    }
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
