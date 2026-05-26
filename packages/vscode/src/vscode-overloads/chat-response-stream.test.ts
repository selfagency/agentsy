import { describe, expect, it } from 'vitest';
import type { CancellationToken, Event, Location, Uri } from 'vscode';

import { createVSCodeChatResponseStream } from './chat-response-stream.js';

interface MockCancellationToken extends CancellationToken {
  cancel(): void;
}

function createMockCancellationToken(initiallyCancelled = false): MockCancellationToken {
  const listeners = new Set<(e: unknown) => unknown>();
  let cancelled = initiallyCancelled;

  return {
    get isCancellationRequested() {
      return cancelled;
    },
    onCancellationRequested: ((listener: (e: unknown) => unknown) => {
      listeners.add(listener);
      return {
        dispose: () => {
          listeners.delete(listener);
        }
      };
    }) as unknown as Event<unknown>,
    cancel() {
      cancelled = true;
      for (const listener of listeners) {
        listeners.delete(listener);
      }
    }
  };
}

describe('VSCode ChatResponseStream Overloads', () => {
  it('should create VSCode chat response stream', () => {
    const stream = createVSCodeChatResponseStream(createMockCancellationToken());
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
    const stream = createVSCodeChatResponseStream(createMockCancellationToken());
    expect(() => {
      stream.markdown('test content', { source: 'test' });
    }).not.toThrow();
  });

  it('should support anchor with options', () => {
    const stream = createVSCodeChatResponseStream(createMockCancellationToken());
    const uri = { toString: () => 'https://example.com' } as unknown as Uri;
    expect(() => {
      stream.anchor(uri as Uri | Location, 'Example');
    }).not.toThrow();
  });

  it('should support button with command options', () => {
    const stream = createVSCodeChatResponseStream(createMockCancellationToken());
    expect(() => {
      stream.button({ arguments: [], command: 'test.command', title: 'Test' });
    }).not.toThrow();
  });

  it('should support filetree with options', () => {
    const stream = createVSCodeChatResponseStream(createMockCancellationToken());
    const baseUri = { toString: () => 'file:///base' } as unknown as Uri;
    expect(() => {
      stream.filetree([{ name: 'test' }], baseUri, { showRoot: true });
    }).not.toThrow();
  });

  it('should support progress with context', () => {
    const stream = createVSCodeChatResponseStream(createMockCancellationToken());
    expect(() => {
      stream.progress('Processing...', { step: 1, total: 10 });
    }).not.toThrow();
  });

  it('should support reference with metadata', () => {
    const stream = createVSCodeChatResponseStream(createMockCancellationToken());
    const uri = { toString: () => 'https://example.com' } as unknown as Uri;
    expect(() => {
      stream.reference(uri as Uri | Location, uri);
    }).not.toThrow();
  });

  it('should support push with validation', () => {
    const stream = createVSCodeChatResponseStream(createMockCancellationToken());
    expect(() => {
      stream.push({}, { validate: true });
    }).not.toThrow();
  });

  it('treats the cancellation token as a no-op guard for the stubbed stream', () => {
    const cancellation = createMockCancellationToken();
    const stream = createVSCodeChatResponseStream(cancellation);

    cancellation.cancel();

    expect(() => {
      stream.markdown('ignored');
      stream.progress('ignored');
      stream.push({ ignored: true });
    }).not.toThrow();
  });
});
