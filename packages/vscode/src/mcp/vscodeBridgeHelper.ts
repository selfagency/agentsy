import type { MCPTransport } from '@agentsy/core/processor';
import { adaptTransportToStream } from '@agentsy/core/processor';
import { parseSSEStream } from '@agentsy/core/sse';
import type { ReadableStream } from 'node:stream/web';
import { type CancellationToken, ChatResponseProgressPart, type ChatResponseStream, Uri } from 'vscode';

/**
 * Extended MCP event types that can be emitted from the transport.
 * These map to MCP message types that should be converted to VS Code chat format.
 */
// fallow-ignore-next-line unused-type
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
    push: 'push'
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
          data: { command: String(command) }
        }),
      filetree: (value, baseUri) =>
        this.pushEvent({
          type: 'filetree',
          data: { value, baseUri: String(baseUri) }
        }),
      progress: value => this.pushEvent({ type: 'progress', data: { value } }),
      reference: (value, iconPath) =>
        this.pushEvent({
          type: 'reference',
          data: {
            value: String(value),
            iconPath: iconPath ? String(iconPath) : undefined
          }
        }),
      push: part => this.pushEvent({ type: 'push', data: part })
    };

    return chatStream;
  }

  /**
   * Connects the MCP transport to an existing ChatResponseStream.
   * This is the recommended pattern: pass in your VS Code ChatResponseStream
   * and this method will populate it with data from the MCP transport.
   */
  // fallow-ignore-next-line unused-class-member
  public connectToStream(stream: ChatResponseStream): void {
    const transportStream = adaptTransportToStream(this.transport);
    void this.processRawStream(transportStream, stream);
  }

  /**
   * Processes raw string chunks from the transport and forwards them to the chat stream.
   */
  private async processRawStream(
    transportStream: ReadableStream<string>,
    chatStream: ChatResponseStream
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
            data: sseEvent.data ? JSON.parse(sseEvent.data) : null
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

    switch (event.type) {
      case 'markdown':
        this.handleMarkdown(data, chatStream);
        break;
      case 'progress':
        this.handleProgress(data, chatStream);
        break;
      case 'anchor':
        this.handleAnchor(data, chatStream);
        break;
      case 'button':
        this.handleButton(data, chatStream);
        break;
      case 'filetree':
        this.handleFiletree(chatStream);
        break;
      case 'reference':
        this.handleReference(data, chatStream);
        break;
      case 'push':
        this.handlePush(chatStream);
        break;
    }
  }

  private handleMarkdown(data: Record<string, unknown>, chatStream: ChatResponseStream): void {
    const content = typeof data.value === 'string' ? data.value : '';
    chatStream.markdown(content);
  }

  private handleProgress(data: Record<string, unknown>, chatStream: ChatResponseStream): void {
    const content = typeof data.value === 'string' ? data.value : '';
    chatStream.progress?.(content);
  }

  private handleAnchor(data: Record<string, unknown>, chatStream: ChatResponseStream): void {
    if (typeof data.anchorData === 'string' && typeof data.title === 'string') {
      chatStream.anchor(Uri.parse(data.anchorData), data.title);
    }
  }

  private handleButton(data: Record<string, unknown>, chatStream: ChatResponseStream): void {
    const commandStr = typeof data.command === 'string' ? data.command : '';
    const titleStr = typeof data.title === 'string' ? data.title : '';
    chatStream.button({ command: commandStr, title: titleStr });
  }

  private handleFiletree(chatStream: ChatResponseStream): void {
    chatStream.filetree?.([], Uri.file('/'));
  }

  private handleReference(data: Record<string, unknown>, chatStream: ChatResponseStream): void {
    const uriStr = typeof data.uri === 'string' ? data.uri : '';
    chatStream.reference(Uri.parse(uriStr));
  }

  private handlePush(chatStream: ChatResponseStream): void {
    chatStream.push?.(new ChatResponseProgressPart(''));
  }

  /**
   * Test-only access to protected helper methods for unit testing.
   * NOTE: This is intentionally public only for testing purposes.
   * @internal
   */
  public _testHandleMarkdown(data: Record<string, unknown>, chatStream: ChatResponseStream): void {
    this.handleMarkdown(data, chatStream);
  }

  public _testHandleProgress(data: Record<string, unknown>, chatStream: ChatResponseStream): void {
    this.handleProgress(data, chatStream);
  }

  public _testHandleAnchor(data: Record<string, unknown>, chatStream: ChatResponseStream): void {
    this.handleAnchor(data, chatStream);
  }

  public _testHandleButton(data: Record<string, unknown>, chatStream: ChatResponseStream): void {
    this.handleButton(data, chatStream);
  }

  public _testHandleFiletree(chatStream: ChatResponseStream): void {
    this.handleFiletree(chatStream);
  }

  public _testHandleReference(data: Record<string, unknown>, chatStream: ChatResponseStream): void {
    this.handleReference(data, chatStream);
  }

  public _testHandlePush(chatStream: ChatResponseStream): void {
    this.handlePush(chatStream);
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
  cancellationToken: CancellationToken
): VSCodeMCPBridgeHelper {
  return new VSCodeMCPBridgeHelper(transport, cancellationToken);
}
