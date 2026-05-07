import { describe, expect, it } from 'vitest';
import type { CancellationToken } from 'vscode';
import type { ChatResponseParameters } from 'vscode';
import { createVSCodeChatResponseStream } from './chatResponseStream.js';

describe('VSCode ChatResponseStream Overloads', () => {
  const mockCancellationToken: CancellationToken = {
    isCancellationRequested: false,
    onCancellationRequested: () => ({ dispose: () => {} }),
  };

  it('should create VSCode chat response stream', () => {
    const stream = createVSCodeChatResponseStream(mockCancellationToken);
    expect(stream).toBeDefined();
    expect(stream).toHaveProperty('markdown');
    expect(stream).toHaveProperty('anchor');
    expect(stream).toHaveProperty('button');
    expect(stream).toHaveProperty('filetree');
    expect(stream).toHaveProperty('progress');
    expect(stream).toHaveProperty('reference');
    expect(stream).toHaveProperty('push');
  });

  it('should support markdown with metadata', () => {
    const stream = createVSCodeChatResponseStream(mockCancellationToken);
    expect(() => {
      stream.markdown('test content', { source: 'test' });
    }).not.toThrow();
  });

  it('should support anchor with options', () => {
    const stream = createVSCodeChatResponseStream(mockCancellationToken);
    expect(() => {
      stream.anchor({ uri: 'https://example.com' }, 'Example');
    }).not.toThrow();
  });

  it('should support button with command options', () => {
    const stream = createVSCodeChatResponseStream(mockCancellationToken);
    expect(() => {
      stream.button({ command: 'test.command', title: 'Test', arguments: [] });
    }).not.toThrow();
  });

  it('should support filetree with options', () => {
    const stream = createVSCodeChatResponseStream(mockCancellationToken);
    expect(() => {
      stream.filetree([{ name: 'test' }], { uri: 'file:///base' }, { showRoot: true });
    }).not.toThrow();
  });

  it('should support progress with context', () => {
    const stream = createVSCodeChatResponseStream(mockCancellationToken);
    expect(() => {
      stream.progress('Processing...', { step: 1, total: 10 });
    }).not.toThrow();
  });

  it('should support reference with metadata', () => {
    const stream = createVSCodeChatResponseStream(mockCancellationToken);
    expect(() => {
      stream.reference('https://example.com', { source: 'test' });
    }).not.toThrow();
  });

  it('should support push with validation', () => {
    const stream = createVSCodeChatResponseStream(mockCancellationToken);
    expect(() => {
      stream.push({}, { validate: true });
    }).not.toThrow();
  });
});
