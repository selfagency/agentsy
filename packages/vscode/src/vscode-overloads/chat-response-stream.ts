import type { CancellationToken, ChatResponseStream, Location, Uri } from 'vscode';

export interface FileTreeEntry {
  children?: FileTreeEntry[];
  name: string;
  path?: string;
}

/**
 * Extended ChatResponseStream interface with additional VS Code-specific overloads.
 */
export interface VSCodeChatResponseStream extends ChatResponseStream {
  anchor(value: Uri | Location, title?: string): void;
  button(command: string | { command: string; title: string; arguments?: unknown[] }): void;
  filetree(value: FileTreeEntry[], baseUri: Uri, options?: { showRoot?: boolean }): void;
  markdown(value: string, metadata?: Record<string, unknown>): void;
  progress(value: string, context?: { step?: number; total?: number }): void;
  push(part: unknown, options?: { validate?: boolean }): void;
  reference(value: Uri | Location, iconPath?: Uri): void;
}

/**
 * Creates a VS Code ChatResponseStream with extended overload capabilities.
 */
export function createVSCodeChatResponseStream(cancellationToken: CancellationToken): VSCodeChatResponseStream {
  let cancelled = cancellationToken.isCancellationRequested;
  const subscription = cancellationToken.onCancellationRequested(() => {
    cancelled = true;
    subscription.dispose();
  });

  const runIfActive = (callback: () => void): void => {
    if (cancelled) {
      return;
    }

    callback();
  };

  const stream: VSCodeChatResponseStream = {
    anchor: (_value: Uri | Location, _title?: string) => {
      runIfActive(() => {
        /* noop */
      });
    },
    button: (_command: string | { command: string; title: string; arguments?: unknown[] }) => {
      runIfActive(() => {
        /* noop */
      });
    },
    filetree: (_value: FileTreeEntry[], _baseUri: Uri, _options?: { showRoot?: boolean }) => {
      runIfActive(() => {
        /* noop */
      });
    },
    markdown: (_value: string, _metadata?: Record<string, unknown>) => {
      runIfActive(() => {
        /* noop */
      });
    },
    progress: (_value: string, _context?: { step?: number; total?: number }) => {
      runIfActive(() => {
        /* noop */
      });
    },
    push: (_part: unknown, _options?: { validate?: boolean }) => {
      runIfActive(() => {
        /* noop */
      });
    },
    reference: (_value: Uri | Location, _iconPath?: Uri) => {
      runIfActive(() => {
        /* noop */
      });
    }
  };

  return stream;
}
