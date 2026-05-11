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
export function createVSCodeChatResponseStream(_cancellationToken: CancellationToken): VSCodeChatResponseStream {
  // Placeholder adapter surface; runtime wiring happens in consumer extension integration.
  return {
    markdown: (_value: string, _metadata?: Record<string, unknown>) => {},
    anchor: (_value: Uri | Location, _title?: string) => {},
    button: (_command: string | { command: string; title: string; arguments?: unknown[] }) => {},
    filetree: (_value: FileTreeEntry[], _baseUri: Uri, _options?: { showRoot?: boolean }) => {},
    progress: (_value: string, _context?: { step?: number; total?: number }) => {},
    reference: (_value: Uri | Location, _iconPath?: Uri) => {},
    push: (_part: unknown, _options?: { validate?: boolean }) => {},
  } as unknown as VSCodeChatResponseStream;
}
