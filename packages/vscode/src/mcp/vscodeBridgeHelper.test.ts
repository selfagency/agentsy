import { describe, it, expect, vi } from 'vitest';
import { VSCodeMCPBridgeHelper, createVSCodeMCPBridge } from './vscodeBridgeHelper.js';
import type { MCPTransport } from '@agentsy/processor';
import type { CancellationToken } from 'vscode';

describe('VSCode MCP Bridge Helper', () => {
  const mockTransport: MCPTransport = {
    type: 'http',
    stream: new ReadableStream<string>({
      start(controller) {
        controller.enqueue('data: test\n\n');
        controller.close();
      },
    }),
  };

  const mockCancellationToken: CancellationToken = {
    isCancellationRequested: false,
    onCancellationRequested: vi.fn(),
  };

  describe('VSCodeMCPBridgeHelper', () => {
    it('should create bridge helper instance', () => {
      const helper = new VSCodeMCPBridgeHelper(mockTransport, mockCancellationToken);
      expect(helper).toBeInstanceOf(VSCodeMCPBridgeHelper);
    });

    it('should return transport', () => {
      const helper = new VSCodeMCPBridgeHelper(mockTransport, mockCancellationToken);
      expect(helper.getTransport()).toBe(mockTransport);
    });

    it('should return cancellation token', () => {
      const helper = new VSCodeMCPBridgeHelper(mockTransport, mockCancellationToken);
      expect(helper.getCancellationToken()).toBe(mockCancellationToken);
    });

    it('should create direct chat response stream', () => {
      const helper = new VSCodeMCPBridgeHelper(mockTransport, mockCancellationToken);
      const stream = helper.createDirectChatResponseStream();
      expect(stream).toHaveProperty('markdown');
      expect(stream).toHaveProperty('anchor');
      expect(stream).toHaveProperty('button');
      expect(stream).toHaveProperty('filetree');
      expect(stream).toHaveProperty('progress');
      expect(stream).toHaveProperty('reference');
      expect(stream).toHaveProperty('push');
    });

    it('should create chat response stream with target', () => {
      const helper = new VSCodeMCPBridgeHelper(mockTransport, mockCancellationToken);
      const targetStream = {
        markdown: vi.fn(),
        anchor: vi.fn(),
        button: vi.fn(),
        filetree: vi.fn(),
        progress: vi.fn(),
        reference: vi.fn(),
        push: vi.fn(),
      };
      const stream = helper.createChatResponseStream(targetStream);
      expect(stream).toBe(targetStream);
    });
  });

  describe('createVSCodeMCPBridge', () => {
    it('should create bridge helper via factory', () => {
      const helper = createVSCodeMCPBridge(mockTransport, mockCancellationToken);
      expect(helper).toBeInstanceOf(VSCodeMCPBridgeHelper);
      expect(helper.getTransport()).toBe(mockTransport);
      expect(helper.getCancellationToken()).toBe(mockCancellationToken);
    });
  });
});
