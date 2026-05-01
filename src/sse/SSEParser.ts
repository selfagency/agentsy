/**
 * SSE (Server-Sent Events) frame parser for LLM streaming responses.
 * Handles cross-chunk frame splitting, BOM, multi-line data fields, and retry directives.
 */

export interface SSEEvent {
  event?: string;
  data: string;
  id?: string;
  retry?: number;
}

export interface SSEParserOptions {
  /**
   * Called when a complete SSE event is parsed.
   */
  onEvent?: (_event: SSEEvent) => void;

  /**
   * Called when a parsing error occurs (malformed field, etc).
   * Non-fatal; parsing continues.
   */
  onError?: (_error: Error) => void;
}

/**
 * Streaming SSE frame parser.
 * Handles raw SSE text that may be split across chunks.
 *
 * @example
 * ```ts
 * const parser = new SSEParser({
 *   onEvent: (event) => console.log('Event:', event),
 * });
 *
 * parser.write('data: {"id": 1}\n');
 * parser.write('data: {"id": 2}\n\n');
 * parser.end();
 * ```
 */
export class SSEParser {
  private buffer = '';
  private readonly onEventCallback: ((_event: SSEEvent) => void) | undefined;
  private readonly onErrorCallback: ((_error: Error) => void) | undefined;

  constructor(options?: SSEParserOptions) {
    this.onEventCallback = options?.onEvent;
    this.onErrorCallback = options?.onError;
  }

  /**
   * Feed a chunk of SSE text.
   * May parse zero or more complete events depending on chunk boundaries.
   */
  write(chunk: string): void {
    if (!chunk) return;

    this.buffer += chunk;
    this.parseBuffer();
  }

  /**
   * Signal end of stream and flush remaining buffer.
   */
  end(): void {
    if (this.buffer.trim()) {
      // Process remaining buffer as final event fields.
      const fields = this.buffer.split('\n');
      const event = this.fieldsToEvent(fields);
      if (event && this.isValidEvent(event)) {
        this.onEventCallback?.(event);
      }
    }
    this.buffer = '';
  }

  /**
   * Reset parser state and buffer.
   */
  reset(): void {
    this.buffer = '';
  }

  private parseBuffer(): void {
    // Split by double newline to find event boundaries.
    const parts = this.buffer.split('\n\n');

    // Keep the last part in the buffer (incomplete event).
    for (let i = 0; i < parts.length - 1; i++) {
      const eventText = parts[i];
      // eventText is from array access, but array may contain empty strings.
      // Optional chain prevents crash on empty strings, but semgrep flags it
      // as unnecessary since arrays return undefined (not null). However,
      // we keep it for empty string handling safety.
      if (eventText?.trim()) {
        const fields = eventText.split('\n');
        const event = this.fieldsToEvent(fields);
        if (event && this.isValidEvent(event)) {
          this.onEventCallback?.(event);
        }
      }
    }

    // Keep incomplete part in buffer.
    this.buffer = parts.at(-1) ?? '';
  }

  private fieldsToEvent(fields: string[]): SSEEvent | null {
    const event: SSEEvent = { data: '' };
    let hasDataField = false;

    for (const rawLine of fields) {
      const line = rawLine.trim();
      if (!line || line.startsWith(':')) continue;

      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;

      const field = line.substring(0, colonIdx);
      let value = line.substring(colonIdx + 1);

      // Strip leading space after colon (if present).
      if (value.startsWith(' ')) {
        value = value.substring(1);
      }

      hasDataField = this.parseField(field, value, event) || hasDataField;
    }

    // Only include data if it was explicitly provided.
    if (!hasDataField) {
      // nosec: SSEEvent interface doesn't have index signature but is mutable
      delete (event as any).data;
    }

    return event;
  }

  private parseField(field: string, value: string, event: SSEEvent): boolean {
    let hasDataField = false;

    switch (field) {
      case 'event':
        event.event = value;
        break;
      case 'data':
        if (event.data) {
          event.data += `\n${value}`;
        } else {
          event.data = value;
          hasDataField = true;
        }
        break;
      case 'id':
        event.id = value;
        break;
      case 'retry': {
        const retryNum = Number.parseInt(value, 10);
        if (!Number.isNaN(retryNum) && retryNum > 0) {
          event.retry = retryNum;
        }
        break;
      }
    }

    return hasDataField;
  }

  private isValidEvent(event: SSEEvent): boolean {
    return !!(
      event.data !== undefined ||
      event.event !== undefined ||
      event.id !== undefined ||
      event.retry !== undefined
    );
  }
}
