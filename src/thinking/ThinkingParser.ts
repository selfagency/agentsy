export interface ThinkingParserOptions {
  openingTag?: string;
  closingTag?: string;
}

export class ThinkingParser {
  public constructor(private readonly _options: ThinkingParserOptions = {}) {}

  public addContent(chunk: string): [thinkingContent: string, regularContent: string] {
    return ['', chunk];
  }

  public reset(): void {
    void this._options;
  }
}
