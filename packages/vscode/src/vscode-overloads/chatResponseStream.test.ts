import { describe, expect, it } from 'vitest';
import type { CancellationToken, Event, Location, Uri } from 'vscode';
import { createVSCodeChatResponseStream } from './chatResponseStream.js';

describe('VSCode ChatResponseStream Overloads', () => {
  const mockCancellationToken: CancellationToken = {
    isCancellationRequested: false,
    onCancellationRequested: ((_listener: (e: unknown) => unknown) => ({
      dispose: () => {},
    })) as unknown as Event<unknown>,
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
    const uri = { toString: () => 'https://example.com' } as unknown as Uri;
    expect(() => {
      stream.anchor(uri as Uri | Location, 'Example');
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
    const baseUri = { toString: () => 'file:///base' } as unknown as Uri;
    expect(() => {
      stream.filetree([{ name: 'test' }], baseUri, { showRoot: true });
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
    const uri = { toString: () => 'https://example.com' } as unknown as Uri;
    expect(() => {
      stream.reference(uri as Uri | Location, uri);
    }).not.toThrow();
  });

  it('should support push with validation', () => {
    const stream = createVSCodeChatResponseStream(mockCancellationToken);
    expect(() => {
      stream.push({}, { validate: true });
    }).not.toThrow();
  });
});
