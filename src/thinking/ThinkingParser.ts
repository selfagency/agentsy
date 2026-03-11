export interface ThinkingParserOptions {
  openingTag?: string;
  closingTag?: string;
}

export class ThinkingParser {
  public constructor(private readonly _options: ThinkingParserOptions = {}) {}

  public addContent(chunk: string): [thinkingContent: string, regularContent: string] {
    const openingTag = this._options.openingTag;
    const closingTag = this._options.closingTag;

    if (!openingTag || !closingTag) {
      return ['', chunk];
    }

    const thinkingParts: string[] = [];
    const regularParts: string[] = [];

    let remaining = chunk;

    // NOTE: This implementation processes each chunk independently. Tags that span
    // multiple chunks will not be detected; streaming callers should buffer content
    // or reassemble before parsing.
    while (remaining.length > 0) {
      const openIndex = remaining.indexOf(openingTag);

      if (openIndex === -1) {
        regularParts.push(remaining);
        break;
      }

      if (openIndex > 0) {
        regularParts.push(remaining.slice(0, openIndex));
      }

      const afterOpen = remaining.slice(openIndex + openingTag.length);
      const closeIndex = afterOpen.indexOf(closingTag);

      if (closeIndex === -1) {
        regularParts.push(remaining.slice(openIndex));
        break;
      }

      thinkingParts.push(afterOpen.slice(0, closeIndex));

      remaining = afterOpen.slice(closeIndex + closingTag.length);
    }

    return [thinkingParts.join(''), regularParts.join('')];
  }
}
