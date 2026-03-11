import { ELEVATED_CONTEXT_TAG_NAMES } from '../xml-filter/tagLists.js';

const XML_CONTEXT_TAG_RE = /<([a-zA-Z_][a-zA-Z0-9_.-]*)[^>]*>[\s\S]*?<\/\1>/gi;

export function splitLeadingXmlContextBlocks(input: string): { contextBlocks: string[]; remaining: string } {
  let remainingText = input;
  let hadLeadingContext = false;
  const contextBlocks: string[] = [];

  if (remainingText.trimStart().startsWith('<')) {
    remainingText = remainingText.trimStart();
    while (true) {
      XML_CONTEXT_TAG_RE.lastIndex = 0;
      const match = XML_CONTEXT_TAG_RE.exec(remainingText);
      if (!match || match.index !== 0) {
        break;
      }

      const tagName = match[1];
      if (!tagName) {
        break;
      }
      if (!ELEVATED_CONTEXT_TAG_NAMES.has(tagName)) {
        break;
      }

      const matchedText = match[0];
      contextBlocks.push(matchedText.trim());
      remainingText = remainingText.slice(matchedText.length).trimStart();
      hadLeadingContext = true;
    }
  }

  return {
    contextBlocks,
    remaining: hadLeadingContext ? remainingText : input,
  };
}
