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

import { EventEmitter } from "node:events";

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
function findIndexOutside(
  haystack: string,
  predicate: (ch: string) => boolean,
  delim = "",
  fromIndex = 0
): number {
  const { length } = haystack;
  let index = fromIndex;
  let inDelim = false;

  while (index < length) {
    const ch = haystack.charAt(index);
    if (!inDelim && predicate(ch)) {
      break;
    }
    if (ch === delim) {
      inDelim = !inDelim;
    }
    index++;
  }

  return index === length ? -1 : index;
}

// ---------------------------------------------------------------------------
// Internal token-type constants
// ---------------------------------------------------------------------------

const NT_TEXT = "text";
const NT_CDATA = "cdata";
const NT_COMMENT = "comment";
const NT_MARKUP_DECL = "markupDeclaration";
const NT_PROC_INST = "processinginstruction";
const NT_TAG_OPEN = "tagopen";
const NT_TAG_CLOSE = "tagclose";

interface WaitState {
  token: string;
  data: string;
}

type ParserStepResult = number | Error | null;

// ---------------------------------------------------------------------------
// Saxophone parser
// ---------------------------------------------------------------------------

/**
 * Streaming SAX XML parser. Accepts string chunks via `write()` / `end()` and
 * emits typed events for each XML node encountered.
 */
export class Saxophone extends EventEmitter {
  private readonly _tagStack: string[] = [];
  private _waiting: WaitState | null = null;

  private _wait(token: string, data: string): void {
    this._waiting = { data, token };
  }

  private _unwait(): string {
    if (this._waiting === null) {
      return "";
    }
    const { data } = this._waiting;
    this._waiting = null;
    return data;
  }

  private _handleTagOpening(node: SaxophoneTag): void {
    if (!node.isSelfClosing) {
      this._tagStack.push(node.name);
    }
    this.emit(NT_TAG_OPEN, node);
  }

  private _emitTextChunk(input: string, pos: number): number {
    const nextTag = input.indexOf("<", pos);

    if (nextTag === -1) {
      this._wait(NT_TEXT, input.slice(pos));
      return input.length;
    }

    this.emit(NT_TEXT, {
      contents: input.slice(pos, nextTag),
    } satisfies SaxophoneText);
    return nextTag;
  }

  private _handleCDataSection(input: string, pos: number): number | null {
    pos += 7;
    const cdataClose = input.indexOf("]]>", pos);

    if (cdataClose === -1) {
      this._wait(NT_CDATA, input.slice(pos - 9));
      return null;
    }

    this.emit(NT_CDATA, {
      contents: input.slice(pos, cdataClose),
    } satisfies SaxophoneCData);
    return cdataClose + 3;
  }

  private _handleComment(input: string, pos: number): ParserStepResult {
    pos += 2;
    const commentClose = input.indexOf("--", pos);

    if (commentClose === -1 || input.charAt(commentClose + 2) === "") {
      this._wait(NT_COMMENT, input.slice(pos - 4));
      return null;
    }

    if (input.charAt(commentClose + 2) !== ">") {
      return new Error(
        `Unexpected -- inside comment: '${input.slice(pos - 4)}'`
      );
    }

    this.emit(NT_COMMENT, {
      contents: input.slice(pos, commentClose),
    } satisfies SaxophoneComment);
    return commentClose + 3;
  }

  private _handleMarkupDeclaration(
    input: string,
    pos: number
  ): ParserStepResult {
    pos += 1;
    const c2 = input.charAt(pos);

    if (c2 === "") {
      this._wait(NT_MARKUP_DECL, input.slice(pos - 2));
      return null;
    }

    if (c2 === "[" && input.slice(pos + 1, pos + 7) === "CDATA[") {
      return this._handleCDataSection(input, pos);
    }

    if (
      c2 === "-" &&
      (input.charAt(pos + 1) === "" || input.charAt(pos + 1) === "-")
    ) {
      return this._handleComment(input, pos);
    }

    return new Error(`Unrecognized sequence: <!${c2}`);
  }

  private _handleProcessingInstruction(
    input: string,
    pos: number
  ): number | null {
    pos += 1;
    const piClose = input.indexOf("?>", pos);

    if (piClose === -1) {
      this._wait(NT_PROC_INST, input.slice(pos - 2));
      return null;
    }

    this.emit(NT_PROC_INST, {
      contents: input.slice(pos, piClose),
    } satisfies SaxophoneProcessingInstruction);
    return piClose + 2;
  }

  private _handleTagChunk(input: string, pos: number): ParserStepResult {
    const tagClose = findIndexOutside(input, (ch) => ch === ">", '"', pos);

    if (tagClose === -1) {
      this._wait(NT_TAG_OPEN, input.slice(pos - 1));
      return null;
    }

    if (input.charAt(pos) === "/") {
      const tagName = input.slice(pos + 1, tagClose);
      const stackedTagName = this._tagStack.pop();

      if (stackedTagName !== tagName) {
        return new Error(`Unclosed tag: ${stackedTagName}`);
      }

      this.emit(NT_TAG_CLOSE, { name: tagName } satisfies SaxophoneTagClose);
      return tagClose + 1;
    }

    const isSelfClosing = input.charAt(tagClose - 1) === "/";
    const realTagClose = isSelfClosing ? tagClose - 1 : tagClose;
    const wsOffset = input.slice(pos).search(/\s/);

    if (wsOffset === -1 || wsOffset >= tagClose - pos) {
      this._handleTagOpening({
        attrs: "",
        isSelfClosing,
        name: input.slice(pos, realTagClose),
      });
    } else if (wsOffset === 0) {
      return new Error("Tag names may not start with whitespace");
    } else {
      this._handleTagOpening({
        attrs: input.slice(pos + wsOffset, realTagClose),
        isSelfClosing,
        name: input.slice(pos, pos + wsOffset),
      });
    }

    return tagClose + 1;
  }

  private _dispatchTagChunk(
    input: string,
    pos: number,
    nextChar: string
  ): ParserStepResult {
    if (nextChar === "!") {
      return this._handleMarkupDeclaration(input, pos);
    }

    if (nextChar === "?") {
      return this._handleProcessingInstruction(input, pos);
    }

    return this._handleTagChunk(input, pos);
  }

  private _parseChunk(input: string): Error | null {
    input = this._unwait() + input;

    let pos = 0;
    const end = input.length;

    while (pos < end) {
      if (input.charAt(pos) !== "<") {
        pos = this._emitTextChunk(input, pos);
        continue;
      }

      pos += 1;
      const nextChar = input.charAt(pos);
      const nextPos = this._dispatchTagChunk(input, pos, nextChar);
      if (nextPos === null) {
        break;
      }
      if (nextPos instanceof Error) {
        return nextPos;
      }
      pos = nextPos;
    }

    return null;
  }

  /** Write a string chunk into the parser. */
  write(chunk: string): this {
    const err = this._parseChunk(chunk);
    if (err) {
      this.emit("error", err);
    }
    return this;
  }

  /** Flush remaining data and finalize the stream. */
  end(chunk = ""): this {
    const err = this._parseChunk(chunk);
    if (err) {
      this.emit("error", err);
      return this;
    }

    if (this._waiting !== null) {
      switch (this._waiting.token) {
        case NT_TEXT: {
          this.emit(NT_TEXT, {
            contents: this._waiting.data,
          } satisfies SaxophoneText);
          break;
        }
        case NT_CDATA: {
          this.emit("error", new Error("Unclosed CDATA section"));
          return this;
        }
        case NT_COMMENT: {
          this.emit("error", new Error("Unclosed comment"));
          return this;
        }
        case NT_PROC_INST: {
          this.emit("error", new Error("Unclosed processing instruction"));
          return this;
        }
        default: {
          this.emit("error", new Error("Unclosed tag"));
          return this;
        }
      }
    }

    if (this._tagStack.length !== 0) {
      this.emit(
        "error",
        new Error(`Unclosed tags: ${this._tagStack.join(",")}`)
      );
      return this;
    }

    this.emit("finish");
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
