import { describe, it, expect, vi } from 'vitest';
import { MCPChatBridge, createMCPChatBridge } from './mcpChatBridge.js';
import type { MCPTransport } from '@agentsy/core/processor';
import type { CancellationToken } from 'vscode';

describe('VSCode Stream Bridge', () => {
  const mockTransport: MCPTransport = {
    type: 'http',
    stream: new ReadableStream<string>({
      start(controller) {
        controller.enqueue('data: test\n\n');
        controller.close();
      }
    })
  };

  const mockCancellationToken: CancellationToken = {
    isCancellationRequested: false,
    onCancellationRequested: vi.fn()
  };

  describe('MCPChatBridge', () => {
    it('should create bridge instance', () => {
      const bridge = new MCPChatBridge(mockTransport, mockCancellationToken);
      expect(bridge).toBeInstanceOf(MCPChatBridge);
    });

    it('should create chat response stream', () => {
      const bridge = new MCPChatBridge(mockTransport, mockCancellationToken);
      const stream = bridge.createStream();
      expect(stream).toBeDefined();
      expect(stream).toHaveProperty('markdown');
      expect(stream).toHaveProperty('anchor');
      expect(stream).toHaveProperty('button');
      expect(stream).toHaveProperty('filetree');
      expect(stream).toHaveProperty('progress');
      expect(stream).toHaveProperty('reference');
      expect(stream).toHaveProperty('push');
    });

    it('should return transport', () => {
      const bridge = new MCPChatBridge(mockTransport, mockCancellationToken);
      expect(bridge.getTransport()).toBe(mockTransport);
    });

    it('should return cancellation token', () => {
      const bridge = new MCPChatBridge(mockTransport, mockCancellationToken);
      expect(bridge.getCancellationToken()).toBe(mockCancellationToken);
    });
  });

  describe('createMCPChatBridge', () => {
    it('should create bridge via factory', () => {
      const bridge = createMCPChatBridge(mockTransport, mockCancellationToken);
      expect(bridge).toBeInstanceOf(MCPChatBridge);
      expect(bridge.getTransport()).toBe(mockTransport);
      expect(bridge.getCancellationToken()).toBe(mockCancellationToken);
    });
  });
});
