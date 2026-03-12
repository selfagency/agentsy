/**
 * Vendored and rewritten port of the `saxophone` SAX-based streaming XML parser.
 * Original: https://github.com/matteodelabre/saxophone (MIT)
 *
 * Changes vs original:
 * - Converted from CommonJS to ESM TypeScript
 * - Replaced `Writable` (readable-stream) base with plain `EventEmitter` —
 *   this library only ever passes string chunks, never Buffers, so the Node
 *   stream machinery is unnecessary.
 * - Removed StringDecoder (Buffer→string decoding no longer needed).
 * - Typed with strict TypeScript; no `any`.
 * - Declaration-merged typed `on()` overloads for IDE discoverability.
 */

import { EventEmitter } from 'node:events';

// ---------------------------------------------------------------------------
// Public node-data types
// ---------------------------------------------------------------------------

export interface SaxophoneTag {
  name: string;
  attrs: string;
  isSelfClosing: boolean;
}

export interface SaxophoneText {
  contents: string;
}

export interface SaxophoneCData {
  contents: string;
}

export interface SaxophoneComment {
  contents: string;
}

export interface SaxophoneProcessingInstruction {
  contents: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Find the first index matching `predicate` while outside `delim`-quoted spans.
 * Returns -1 if not found.
 */
function findIndexOutside(haystack: string, predicate: (ch: string) => boolean, delim = '', fromIndex = 0): number {
  const length = haystack.length;
  let index = fromIndex;
  let inDelim = false;

  while (index < length) {
    const ch = haystack.charAt(index);
    if (!inDelim && predicate(ch)) break;
    if (ch === delim) inDelim = !inDelim;
    index++;
  }

  return index === length ? -1 : index;
}

// ---------------------------------------------------------------------------
// Internal token-type constants
// ---------------------------------------------------------------------------

const NT_TEXT = 'text';
const NT_CDATA = 'cdata';
const NT_COMMENT = 'comment';
const NT_MARKUP_DECL = 'markupDeclaration';
const NT_PROC_INST = 'processinginstruction';
const NT_TAG_OPEN = 'tagopen';
const NT_TAG_CLOSE = 'tagclose';

interface WaitState {
  token: string;
  data: string;
}

// ---------------------------------------------------------------------------
// Saxophone parser
// ---------------------------------------------------------------------------

/**
 * Streaming SAX XML parser. Accepts string chunks via `write()` / `end()` and
 * emits typed events for each XML node encountered.
 */
export class Saxophone extends EventEmitter {
  private _tagStack: string[] = [];
  private _waiting: WaitState | null = null;

  // ── wait-state helpers ────────────────────────────────────────────────────

  private _wait(token: string, data: string): void {
    this._waiting = { token, data };
  }

  private _unwait(): string {
    if (this._waiting === null) return '';
    const data = this._waiting.data;
    this._waiting = null;
    return data;
  }

  // ── tag-open handler ─────────────────────────────────────────────────────

  private _handleTagOpening(node: SaxophoneTag): void {
    if (!node.isSelfClosing) {
      this._tagStack.push(node.name);
    }
    this.emit(NT_TAG_OPEN, node);
  }

  // ── core chunk parser ─────────────────────────────────────────────────────

  private _parseChunk(input: string): Error | null {
    input = this._unwait() + input;

    let pos = 0;
    const end = input.length;

    while (pos < end) {
      if (input.charAt(pos) !== '<') {
        const nextTag = input.indexOf('<', pos);

        // No closing tag in sight — buffer the text and wait for more data.
        if (nextTag === -1) {
          this._wait(NT_TEXT, input.slice(pos));
          break;
        }

        this.emit(NT_TEXT, { contents: input.slice(pos, nextTag) } satisfies SaxophoneText);
        pos = nextTag;
      }

      // pos now points at '<'; advance past it.
      pos += 1;
      const nextChar = input.charAt(pos);

      // ── <! … ────────────────────────────────────────────────────────────
      if (nextChar === '!') {
        pos += 1;
        const c2 = input.charAt(pos);

        // Incomplete markup declaration — wait for more.
        if (c2 === '') {
          this._wait(NT_MARKUP_DECL, input.slice(pos - 2));
          break;
        }

        // <![CDATA[ … ]]>
        if (c2 === '[' && input.slice(pos + 1, pos + 7) === 'CDATA[') {
          pos += 7;
          const cdataClose = input.indexOf(']]>', pos);

          if (cdataClose === -1) {
            this._wait(NT_CDATA, input.slice(pos - 9));
            break;
          }

          this.emit(NT_CDATA, { contents: input.slice(pos, cdataClose) } satisfies SaxophoneCData);
          pos = cdataClose + 3;
          continue;
        }

        // <!-- … -->
        if (c2 === '-' && (input.charAt(pos + 1) === '' || input.charAt(pos + 1) === '-')) {
          pos += 2;
          const commentClose = input.indexOf('--', pos);

          if (commentClose === -1 || input.charAt(commentClose + 2) === '') {
            this._wait(NT_COMMENT, input.slice(pos - 4));
            break;
          }

          if (input.charAt(commentClose + 2) !== '>') {
            return new Error(`Unexpected -- inside comment: '${input.slice(pos - 4)}'`);
          }

          this.emit(NT_COMMENT, {
            contents: input.slice(pos, commentClose),
          } satisfies SaxophoneComment);
          pos = commentClose + 3;
          continue;
        }

        return new Error('Unrecognized sequence: <!' + c2);
      }

      // ── <? … ?> ─────────────────────────────────────────────────────────
      if (nextChar === '?') {
        pos += 1;
        const piClose = input.indexOf('?>', pos);

        if (piClose === -1) {
          this._wait(NT_PROC_INST, input.slice(pos - 2));
          break;
        }

        this.emit(NT_PROC_INST, {
          contents: input.slice(pos, piClose),
        } satisfies SaxophoneProcessingInstruction);
        pos = piClose + 2;
        continue;
      }

      // ── regular tag < … > ───────────────────────────────────────────────
      const tagClose = findIndexOutside(input, ch => ch === '>', '"', pos);

      if (tagClose === -1) {
        this._wait(NT_TAG_OPEN, input.slice(pos - 1));
        break;
      }

      // Closing tag </name>
      if (input.charAt(pos) === '/') {
        const tagName = input.slice(pos + 1, tagClose);
        const stackedTagName = this._tagStack.pop();

        if (stackedTagName !== tagName) {
          return new Error(`Unclosed tag: ${stackedTagName}`);
        }

        this.emit(NT_TAG_CLOSE, { name: tagName } satisfies SaxophoneTagClose);
        pos = tagClose + 1;
        continue;
      }

      // Opening / self-closing tag
      const isSelfClosing = input.charAt(tagClose - 1) === '/';
      const realTagClose = isSelfClosing ? tagClose - 1 : tagClose;
      const wsOffset = input.slice(pos).search(/\s/);

      if (wsOffset === -1 || wsOffset >= tagClose - pos) {
        // Tag with no attributes
        this._handleTagOpening({
          name: input.slice(pos, realTagClose),
          attrs: '',
          isSelfClosing,
        });
      } else if (wsOffset === 0) {
        return new Error('Tag names may not start with whitespace');
      } else {
        // Tag with attributes
        this._handleTagOpening({
          name: input.slice(pos, pos + wsOffset),
          attrs: input.slice(pos + wsOffset, realTagClose),
          isSelfClosing,
        });
      }

      pos = tagClose + 1;
    }

    return null;
  }

  // ── public API ────────────────────────────────────────────────────────────

  /** Write a string chunk into the parser. */
  write(chunk: string): this {
    const err = this._parseChunk(chunk);
    if (err) this.emit('error', err);
    return this;
  }

  /** Flush remaining data and finalize the stream. */
  end(chunk = ''): this {
    const err = this._parseChunk(chunk);
    if (err) {
      this.emit('error', err);
      return this;
    }

    // Handle tokens that were still waiting for more data at end-of-stream.
    if (this._waiting !== null) {
      switch (this._waiting.token) {
        case NT_TEXT:
          // Text nodes are implicitly closed by end-of-stream.
          this.emit(NT_TEXT, { contents: this._waiting.data } satisfies SaxophoneText);
          break;
        case NT_CDATA:
          this.emit('error', new Error('Unclosed CDATA section'));
          return this;
        case NT_COMMENT:
          this.emit('error', new Error('Unclosed comment'));
          return this;
        case NT_PROC_INST:
          this.emit('error', new Error('Unclosed processing instruction'));
          return this;
        default:
          // NT_TAG_OPEN / NT_TAG_CLOSE / NT_MARKUP_DECL
          this.emit('error', new Error('Unclosed tag'));
          return this;
      }
    }

    if (this._tagStack.length !== 0) {
      this.emit('error', new Error(`Unclosed tags: ${this._tagStack.join(',')}`));
      return this;
    }

    this.emit('finish');
    return this;
  }

  /** Convenience: parse a complete XML string in one call. */
  parse(input: string): this {
    return this.end(input);
  }
}

// ---------------------------------------------------------------------------
// Separate type for tagclose events (only has `name`)
// ---------------------------------------------------------------------------

export interface SaxophoneTagClose {
  name: string;
}

export default Saxophone;
