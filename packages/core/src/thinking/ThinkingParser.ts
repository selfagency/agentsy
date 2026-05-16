/** Options for customising the thinking tag pair recognised by `ThinkingParser`. */
export interface ThinkingParserOptions {
  openingTag?: string;
  closingTag?: string;
}

export type ThinkingTagPair = readonly [openingTag: string, closingTag: string];

const BUILTIN_THINKING_TAG_MAP = new Map<string, ThinkingTagPair>([
  ["deepseek", ["<think>", "</think>"]],
  ["qwen", ["<think>", "</think>"]],
  ["llama", ["<think>", "</think>"]],
  ["mistral", ["<think>", "</think>"]],
  ["granite", ["<|thinking|>", "</|thinking|>"]],
]);

type ThinkingState =
  | "lookingForOpening"
  | "thinkingStartedEatingWhitespace"
  | "thinking"
  | "thinkingDoneEatingWhitespace"
  | "thinkingDone";

/**
 * Streaming parser that extracts `<think>…</think>` blocks (or a custom tag pair)
 * from LLM output as it arrives chunk-by-chunk.
 *
 * Call `addContent(chunk)` for each incoming chunk and `flush()` at stream end
 * to drain any partially-accumulated state.
 */
export class ThinkingParser {
  private _state: ThinkingState = "lookingForOpening";
  private _acc = "";

  public readonly openingTag: string;
  public readonly closingTag: string;

  public constructor(options: ThinkingParserOptions = {}) {
    this.openingTag = options.openingTag ?? "<think>";
    this.closingTag = options.closingTag ?? "</think>";
  }

  /**
   * Returns a `ThinkingParser` pre-configured for a known model ID.
   * Falls back to the default `<think>` / `</think>` tags for unrecognised models.
   */
  public static forModel(
    modelId: string,
    thinkingTagMap?: Map<string, ThinkingTagPair>
  ): ThinkingParser {
    const combinedMap = new Map<string, ThinkingTagPair>(
      BUILTIN_THINKING_TAG_MAP
    );
    if (thinkingTagMap) {
      for (const [key, pair] of thinkingTagMap.entries()) {
        combinedMap.set(key, pair);
      }
    }

    const normalizedModelId = modelId.toLowerCase();
    const exact = combinedMap.get(normalizedModelId);
    if (exact) {
      return new ThinkingParser({ closingTag: exact[1], openingTag: exact[0] });
    }

    for (const [key, pair] of combinedMap.entries()) {
      if (normalizedModelId.includes(key.toLowerCase())) {
        return new ThinkingParser({ closingTag: pair[1], openingTag: pair[0] });
      }
    }

    return new ThinkingParser();
  }

  /**
   * Processes a streaming text chunk, splitting it into thinking and regular content.
   * @returns `[thinkingContent, regularContent]` deltas for this chunk.
   */
  public addContent(
    chunk: string
  ): [thinkingContent: string, regularContent: string] {
    this._acc += chunk;
    let thinkingOut = "";
    let contentOut = "";
    let keepLooping = true;

    while (keepLooping) {
      const [thinkingDelta, contentDelta, shouldContinue] = this._eat();
      thinkingOut += thinkingDelta;
      contentOut += contentDelta;
      keepLooping = shouldContinue;
    }

    return [thinkingOut, contentOut];
  }

  /**
   * Flushes any partially-buffered content and returns the final `[thinking, content]` delta.
   * Call once after the last `addContent()` call.
   */
  public flush(): [thinkingContent: string, regularContent: string] {
    const acc = this._acc;
    this._acc = "";

    switch (this._state) {
      case "lookingForOpening": {
        // Held as a potential partial opening tag – treat as regular content.
        return ["", acc];
      }
      case "thinkingStartedEatingWhitespace":
      case "thinkingDoneEatingWhitespace": {
        // Only buffered whitespace; nothing meaningful to emit.
        return ["", ""];
      }
      case "thinking": {
        // Stream ended without a closing tag – emit accumulated text as thinking.
        return [acc, ""];
      }
      case "thinkingDone": {
        return ["", acc];
      }
    }
  }

  /** Check if the parser is in an incomplete state without flushing */
  public isIncomplete(): boolean {
    return this._state === "thinking";
  }

  public reset(): void {
    this._state = "lookingForOpening";
    this._acc = "";
  }

  private static _openComesFirst(openIdx: number, closeIdx: number): boolean {
    return openIdx !== -1 && (closeIdx === -1 || openIdx < closeIdx);
  }

  private _findTopLevelClose(
    text: string,
    openTag: string,
    closeTag: string
  ): number {
    let depth = 0;
    let searchFrom = 0;
    while (searchFrom < text.length) {
      const closeIdx = text.indexOf(closeTag, searchFrom);
      const openIdx = text.indexOf(openTag, searchFrom);

      if (closeIdx === -1 && openIdx === -1) {
        return -1;
      }

      if (ThinkingParser._openComesFirst(openIdx, closeIdx)) {
        depth++;
        searchFrom = openIdx + openTag.length;
        continue;
      }

      if (closeIdx !== -1) {
        if (depth > 0) {
          depth--;
          searchFrom = closeIdx + closeTag.length;
          continue;
        }
        return closeIdx;
      }
    }
    return -1;
  }

  private _eatLookingForOpening(): [string, string, boolean] {
    const trimmed = this._acc.trimStart();
    if (trimmed.startsWith(this.openingTag)) {
      const after = trimmed.slice(this.openingTag.length).trimStart();
      this._acc = after;
      this._state =
        after === "" ? "thinkingStartedEatingWhitespace" : "thinking";
      return ["", "", true];
    }

    if (this.openingTag.startsWith(trimmed) && trimmed !== "") {
      return ["", "", false];
    }

    if (trimmed === "") {
      return ["", "", false];
    }

    this._state = "thinkingDone";
    const out = this._acc;
    this._acc = "";
    return ["", out, false];
  }

  private _eatThinkingDone(): [string, string, boolean] {
    const openIdx = this._acc.indexOf(this.openingTag);
    if (openIdx !== -1) {
      const contentBefore = this._acc.slice(0, openIdx);
      this._acc = this._acc.slice(openIdx);
      this._state = "lookingForOpening";
      return ["", contentBefore, true];
    }

    const out = this._acc;
    this._acc = "";
    return ["", out, false];
  }

  private _eat(): [
    thinkingContent: string,
    regularContent: string,
    shouldContinue: boolean,
  ] {
    switch (this._state) {
      case "lookingForOpening": {
        return this._eatLookingForOpening();
      }

      case "thinkingStartedEatingWhitespace": {
        const trimmed = this._acc.trimStart();
        this._acc = "";
        if (trimmed === "") {
          return ["", "", false];
        }
        this._state = "thinking";
        this._acc = trimmed;
        return ["", "", true];
      }

      case "thinking": {
        const closeIdx = this._findTopLevelClose(
          this._acc,
          this.openingTag,
          this.closingTag
        );
        if (closeIdx === -1) {
          return ["", "", false];
        }

        const thinking = this._acc.slice(0, closeIdx);
        const afterRaw = this._acc.slice(closeIdx + this.closingTag.length);
        this._acc = afterRaw;

        if (afterRaw === "") {
          this._state = "thinkingDone";
          return [thinking, "", false];
        }

        const afterTrimmed = afterRaw.trimStart();
        this._state =
          afterTrimmed === "" ? "thinkingDoneEatingWhitespace" : "thinkingDone";
        return [thinking, "", true];
      }

      case "thinkingDoneEatingWhitespace": {
        const trimmed = this._acc.trimStart();
        this._acc = "";
        if (trimmed !== "") {
          this._state = "thinkingDone";
        }
        return ["", trimmed, false];
      }

      case "thinkingDone": {
        return this._eatThinkingDone();
      }
    }
  }
}
