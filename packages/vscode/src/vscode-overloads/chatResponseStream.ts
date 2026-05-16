import type { CancellationToken, ChatResponseStream, Location, Uri } from 'vscode';

export interface FileTreeEntry {
  name: string;
  path?: string;
  children?: FileTreeEntry[];
}

/**
 * Extended ChatResponseStream interface with additional VS Code-specific overloads.
 */
export interface VSCodeChatResponseStream extends ChatResponseStream {
  markdown(value: string, metadata?: Record<string, unknown>): void;
  anchor(value: Uri | Location, title?: string): void;
  button(command: string | { command: string; title: string; arguments?: unknown[] }): void;
  filetree(value: FileTreeEntry[], baseUri: Uri, options?: { showRoot?: boolean }): void;
  progress(value: string, context?: { step?: number; total?: number }): void;
  reference(value: Uri | Location, iconPath?: Uri): void;
  push(part: unknown, options?: { validate?: boolean }): void;
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
      runIfActive(() => {});
    },
    button: (_command: string | { command: string; title: string; arguments?: unknown[] }) => {
      runIfActive(() => {});
    },
    filetree: (_value: FileTreeEntry[], _baseUri: Uri, _options?: { showRoot?: boolean }) => {
      runIfActive(() => {});
    },
    markdown: (_value: string, _metadata?: Record<string, unknown>) => {
      runIfActive(() => {});
    },
    progress: (_value: string, _context?: { step?: number; total?: number }) => {
      runIfActive(() => {});
    },
    push: (_part: unknown, _options?: { validate?: boolean }) => {
      runIfActive(() => {});
    },
    reference: (_value: Uri | Location, _iconPath?: Uri) => {
      runIfActive(() => {});
    }
  };

  return stream;
}
