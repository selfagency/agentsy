// fallow-ignore-file unused-file

/**
 * Mock for VS Code API.
 * This is used during testing when running outside the VS Code extension host context.
 */

export class Uri {
  public scheme = 'file';
  public authority = '';
  public path = '';
  public query = '';
  public fragment = '';
  public fsPath = '';

  constructor(schemeOrValue?: string, authority?: string, path?: string, query?: string, fragment?: string) {
    if (schemeOrValue && authority && path) {
      // Full constructor with all parameters
      this.scheme = schemeOrValue;
      this.authority = authority ?? '';
      this.path = path ?? '';
      this.query = query ?? '';
      this.fragment = fragment ?? '';
    } else if (schemeOrValue) {
      // Single string parameter - treating as value to parse
      this.path = schemeOrValue;
    }
  }

  static parse(_value: string): Uri {
    const uri = new Uri();
    uri.path = _value;
    return uri;
  }

  static file(_path: string): Uri {
    const uri = new Uri();
    uri.scheme = 'file';
    uri.path = _path;
    uri.fsPath = _path;
    return uri;
  }

  toString(): string {
    return this.path;
  }
}

export class ChatResponseProgressPart {
  constructor(public value: string) {}
}

export class Location {
  constructor(
    public uri: Uri,
    public range: { start: { line: number; character: number }; end: { line: number; character: number } }
  ) {}
}

export interface ChatResponseStream {
  markdown(value: string | { value: string }): void;
  progress(value: string): void;
  reference(value: unknown): void;
  anchor(value: unknown, title?: string): void;
  button(value: unknown): void;
  filetree(dir: unknown, baseUri: unknown): void;
  push(part: unknown): void;
}

export interface CancellationToken {
  isCancellationRequested: boolean;
  onCancellationRequested(listener: () => void): { dispose(): void };
}

export interface ExtensionContext {
  storagePath: string;
  globalStoragePath: string;
  extensionUri: Uri;
  extensionMode: number;
}

// Minimal mock interfaces for type compatibility
export interface LanguageModelChatProvider {
  id?: string;
}
export interface ChatContext {
  history?: unknown[];
}
export interface ChatRequest {
  prompt: string;
}
export interface ChatResponse {
  result?: unknown;
}
export interface ChatResult {
  metadata?: Record<string, unknown>;
}
export interface ExternalUri {
  uri: string;
}
export interface ChatMessage {
  role: string;
  content: string;
}
