import { describe, it, expect, vi } from 'vitest';
import { VSCodeMCPBridgeHelper, createVSCodeMCPBridge } from './vscodeBridgeHelper.js';
import type { MCPTransport } from '@agentsy/core/processor';
import type { CancellationToken, ChatResponseStream } from 'vscode';
import { Uri } from 'vscode';

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

    describe('handleMarkdown', () => {
      it('should handle markdown event with string value', () => {
        const helper = new VSCodeMCPBridgeHelper(mockTransport, mockCancellationToken);
        const mockChatStream = {
          markdown: vi.fn(),
        } as unknown as ChatResponseStream;

        const event = { type: 'markdown' as const, data: { value: 'test markdown' } };
        (helper as any).handleMarkdown(event.data, mockChatStream);

        expect(mockChatStream.markdown).toHaveBeenCalledWith('test markdown');
      });

      it('should handle markdown event with non-string value', () => {
        const helper = new VSCodeMCPBridgeHelper(mockTransport, mockCancellationToken);
        const mockChatStream = {
          markdown: vi.fn(),
        } as unknown as ChatResponseStream;

        const event = { type: 'markdown' as const, data: { value: 123 } };
        (helper as any).handleMarkdown(event.data, mockChatStream);

        expect(mockChatStream.markdown).toHaveBeenCalledWith('');
      });

      it('should handle markdown event with missing value', () => {
        const helper = new VSCodeMCPBridgeHelper(mockTransport, mockCancellationToken);
        const mockChatStream = {
          markdown: vi.fn(),
        } as unknown as ChatResponseStream;

        const event = { type: 'markdown' as const, data: {} };
        (helper as any).handleMarkdown(event.data, mockChatStream);

        expect(mockChatStream.markdown).toHaveBeenCalledWith('');
      });
    });

    describe('handleProgress', () => {
      it('should handle progress event with string value', () => {
        const helper = new VSCodeMCPBridgeHelper(mockTransport, mockCancellationToken);
        const mockChatStream = {
          progress: vi.fn(),
        } as unknown as ChatResponseStream;

        const event = { type: 'progress' as const, data: { value: 'loading...' } };
        (helper as any).handleProgress(event.data, mockChatStream);

        expect(mockChatStream.progress).toHaveBeenCalledWith('loading...');
      });

      it('should handle progress event with non-string value', () => {
        const helper = new VSCodeMCPBridgeHelper(mockTransport, mockCancellationToken);
        const mockChatStream = {
          progress: vi.fn(),
        } as unknown as ChatResponseStream;

        const event = { type: 'progress' as const, data: { value: 123 } };
        (helper as any).handleProgress(event.data, mockChatStream);

        expect(mockChatStream.progress).toHaveBeenCalledWith('');
      });
    });

    describe('handleAnchor', () => {
      it('should handle anchor event with valid data', () => {
        const helper = new VSCodeMCPBridgeHelper(mockTransport, mockCancellationToken);
        const mockChatStream = {
          anchor: vi.fn(),
        } as unknown as ChatResponseStream;

        const event = { type: 'anchor' as const, data: { anchorData: '#section', title: 'Section' } };
        (helper as any).handleAnchor(event.data, mockChatStream);

        expect(mockChatStream.anchor).toHaveBeenCalledWith(Uri.parse('#section'), 'Section');
      });

      it('should skip anchor event with missing anchorData', () => {
        const helper = new VSCodeMCPBridgeHelper(mockTransport, mockCancellationToken);
        const mockChatStream = {
          anchor: vi.fn(),
        } as unknown as ChatResponseStream;

        const event = { type: 'anchor' as const, data: { title: 'Section' } };
        (helper as any).handleAnchor(event.data, mockChatStream);

        expect(mockChatStream.anchor).not.toHaveBeenCalled();
      });

      it('should skip anchor event with missing title', () => {
        const helper = new VSCodeMCPBridgeHelper(mockTransport, mockCancellationToken);
        const mockChatStream = {
          anchor: vi.fn(),
        } as unknown as ChatResponseStream;

        const event = { type: 'anchor' as const, data: { anchorData: '#section' } };
        (helper as any).handleAnchor(event.data, mockChatStream);

        expect(mockChatStream.anchor).not.toHaveBeenCalled();
      });

      it('should skip anchor event with non-string anchorData', () => {
        const helper = new VSCodeMCPBridgeHelper(mockTransport, mockCancellationToken);
        const mockChatStream = {
          anchor: vi.fn(),
        } as unknown as ChatResponseStream;

        const event = { type: 'anchor' as const, data: { anchorData: 123, title: 'Section' } };
        (helper as any).handleAnchor(event.data, mockChatStream);

        expect(mockChatStream.anchor).not.toHaveBeenCalled();
      });

      it('should skip anchor event with non-string title', () => {
        const helper = new VSCodeMCPBridgeHelper(mockTransport, mockCancellationToken);
        const mockChatStream = {
          anchor: vi.fn(),
        } as unknown as ChatResponseStream;

        const event = { type: 'anchor' as const, data: { anchorData: '#section', title: 123 } };
        (helper as any).handleAnchor(event.data, mockChatStream);

        expect(mockChatStream.anchor).not.toHaveBeenCalled();
      });
    });

    describe('handleButton', () => {
      it('should handle button event with valid data', () => {
        const helper = new VSCodeMCPBridgeHelper(mockTransport, mockCancellationToken);
        const mockChatStream = {
          button: vi.fn(),
        } as unknown as ChatResponseStream;

        const event = { type: 'button' as const, data: { command: 'test.command', title: 'Test Button' } };
        (helper as any).handleButton(event.data, mockChatStream);

        expect(mockChatStream.button).toHaveBeenCalledWith({ command: 'test.command', title: 'Test Button' });
      });

      it('should handle button event with missing command', () => {
        const helper = new VSCodeMCPBridgeHelper(mockTransport, mockCancellationToken);
        const mockChatStream = {
          button: vi.fn(),
        } as unknown as ChatResponseStream;

        const event = { type: 'button' as const, data: { title: 'Test Button' } };
        (helper as any).handleButton(event.data, mockChatStream);

        expect(mockChatStream.button).toHaveBeenCalledWith({ command: '', title: 'Test Button' });
      });

      it('should handle button event with missing title', () => {
        const helper = new VSCodeMCPBridgeHelper(mockTransport, mockCancellationToken);
        const mockChatStream = {
          button: vi.fn(),
        } as unknown as ChatResponseStream;

        const event = { type: 'button' as const, data: { command: 'test.command' } };
        (helper as any).handleButton(event.data, mockChatStream);

        expect(mockChatStream.button).toHaveBeenCalledWith({ command: 'test.command', title: '' });
      });

      it('should handle button event with non-string command', () => {
        const helper = new VSCodeMCPBridgeHelper(mockTransport, mockCancellationToken);
        const mockChatStream = {
          button: vi.fn(),
        } as unknown as ChatResponseStream;

        const event = { type: 'button' as const, data: { command: 123, title: 'Test Button' } };
        (helper as any).handleButton(event.data, mockChatStream);

        expect(mockChatStream.button).toHaveBeenCalledWith({ command: '', title: 'Test Button' });
      });

      it('should handle button event with non-string title', () => {
        const helper = new VSCodeMCPBridgeHelper(mockTransport, mockCancellationToken);
        const mockChatStream = {
          button: vi.fn(),
        } as unknown as ChatResponseStream;

        const event = { type: 'button' as const, data: { command: 'test.command', title: 123 } };
        (helper as any).handleButton(event.data, mockChatStream);

        expect(mockChatStream.button).toHaveBeenCalledWith({ command: 'test.command', title: '' });
      });
    });

    describe('handleFiletree', () => {
      it('should handle filetree event', () => {
        const helper = new VSCodeMCPBridgeHelper(mockTransport, mockCancellationToken);
        const mockChatStream = {
          filetree: vi.fn(),
        } as unknown as ChatResponseStream;

        (helper as any).handleFiletree(mockChatStream);

        expect(mockChatStream.filetree).toHaveBeenCalledWith([], Uri.file('/'));
      });

      it('should handle filetree event safely if method is missing', () => {
        const helper = new VSCodeMCPBridgeHelper(mockTransport, mockCancellationToken);
        const mockChatStream = {} as unknown as ChatResponseStream;

        expect(() => {
          (helper as any).handleFiletree(mockChatStream);
        }).not.toThrow();
      });
    });

    describe('handleReference', () => {
      it('should handle reference event with valid uri', () => {
        const helper = new VSCodeMCPBridgeHelper(mockTransport, mockCancellationToken);
        const mockChatStream = {
          reference: vi.fn(),
        } as unknown as ChatResponseStream;

        const event = { type: 'reference' as const, data: { uri: 'file:///path/to/file' } };
        (helper as any).handleReference(event.data, mockChatStream);

        expect(mockChatStream.reference).toHaveBeenCalledWith(Uri.parse('file:///path/to/file'));
      });

      it('should handle reference event with missing uri', () => {
        const helper = new VSCodeMCPBridgeHelper(mockTransport, mockCancellationToken);
        const mockChatStream = {
          reference: vi.fn(),
        } as unknown as ChatResponseStream;

        const event = { type: 'reference' as const, data: {} };
        (helper as any).handleReference(event.data, mockChatStream);

        expect(mockChatStream.reference).toHaveBeenCalledWith(Uri.parse(''));
      });

      it('should handle reference event with non-string uri', () => {
        const helper = new VSCodeMCPBridgeHelper(mockTransport, mockCancellationToken);
        const mockChatStream = {
          reference: vi.fn(),
        } as unknown as ChatResponseStream;

        const event = { type: 'reference' as const, data: { uri: 123 } };
        (helper as any).handleReference(event.data, mockChatStream);

        expect(mockChatStream.reference).toHaveBeenCalledWith(Uri.parse(''));
      });
    });

    describe('handlePush', () => {
      it('should handle push event', () => {
        const helper = new VSCodeMCPBridgeHelper(mockTransport, mockCancellationToken);
        const mockChatStream = {
          push: vi.fn(),
        } as unknown as ChatResponseStream;

        (helper as any).handlePush(mockChatStream);

        expect(mockChatStream.push).toHaveBeenCalled();
      });

      it('should handle push event safely if method is missing', () => {
        const helper = new VSCodeMCPBridgeHelper(mockTransport, mockCancellationToken);
        const mockChatStream = {} as unknown as ChatResponseStream;

        expect(() => {
          (helper as any).handlePush(mockChatStream);
        }).not.toThrow();
      });
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
