import type { CancellationToken, ChatResponseStream, Location, Uri } from 'vscode';

/**
 * Represents a single entry in a filetree.
 */
export interface FileTreeEntry {
  name: string;
  path?: string;
  children?: FileTreeEntry[];
}

/**
 * Extended ChatResponseStream interface with additional VS Code-specific overloads
 * for better type safety and developer experience.
 */
export interface VSCodeChatResponseStream extends ChatResponseStream {
  /**
   * Overload for markdown content with additional metadata support.
   */
  markdown(value: string, metadata?: Record<string, unknown>): void;

  /**
   * Overload for anchor with additional options.
   */
  anchor(value: Uri | Location, title?: string): void;

  /**
   * Overload for button with command options.
   */
  button(command: string | { command: string; title: string; arguments?: unknown[] }): void;

  /**
   * Overload for filetree with base URI options.
   */
  filetree(value: FileTreeEntry[], baseUri: Uri, options?: { showRoot?: boolean }): void;

  /**
   * Overload for progress with additional context.
   */
  progress(value: string, context?: { step?: number; total?: number }): void;

  /**
   * Overload for reference with additional metadata.
   */
  reference(value: Uri | Location, iconPath?: Uri): void;

  /**
   * Extended push method with additional validation.
   */
  push(part: unknown, options?: { validate?: boolean }): void;
}

/**
 * Creates a VS Code ChatResponseStream with extended capabilities.
 * This is the recommended way to create chat response streams in VS Code extensions.
 */
export function createVSCodeChatResponseStream(cancellationToken: CancellationToken): VSCodeChatResponseStream {
  // In a real implementation, this would create an actual ChatResponseStream
  // with the extended capabilities. For now, we return a mock implementation.
  return {
    markdown: (value: string, metadata?: Record<string, unknown>) => {
      // Implementation would handle markdown with metadata
    },
    anchor: (value: Uri | Location, _title?: string) => {
      // Implementation would handle anchor with title
    },
    button: (command: string | { command: string; title: string; arguments?: unknown[] }) => {
      // Implementation would handle button with command options
    },
    filetree: (value: Array<{ name: string }>, baseUri: Uri, options?: { showRoot?: boolean }) => {
      // Implementation would handle filetree with options
    },
    progress: (value: string, _context?: { step?: number; total?: number }) => {
      // Implementation would handle progress with context
    },
    reference: (value: Uri | Location, iconPath?: Uri) => {
      // Implementation would handle reference with iconPath
    },
    push: (part: unknown, _options?: { validate?: boolean }) => {
      // Implementation would push parts with validation
    },
  };
}
