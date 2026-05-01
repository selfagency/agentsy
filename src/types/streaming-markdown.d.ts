/**
 * Type declarations for streaming-markdown and dompurify peer dependencies.
 * These libraries don't ship their own types, so we declare them here.
 */

declare module 'streaming-markdown' {
  namespace StreamingMarkdown {
    function parser_create(options: { target: any }): any;
    function parser_write(text: string): void;
    function parser_write(parser: any, chunk: string): void;
    function parser_end(): string;
    function parser_end(parser: any): string;
    let removed: unknown[] | undefined;
  }

  export = StreamingMarkdown;
}

declare module 'dompurify' {
  namespace DOMPurify {
    function sanitize(dirty: string): string;
    function sanitize(dirty: Element): Element;
    let removed: unknown[] | undefined;
  }

  export = DOMPurify;
}
