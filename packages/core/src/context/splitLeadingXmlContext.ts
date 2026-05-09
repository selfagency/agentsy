import { ELEVATED_CONTEXT_TAG_NAMES } from '../xml-filter/index.js';

// Hardening: Limit max context block size to prevent DoS via catastrophic backtracking
const MAX_CONTEXT_BLOCK_LENGTH = 100_000;
// Hardening: Limit iterations to prevent infinite loops on malformed input
const MAX_ITERATIONS = 100;

/**
 * Optimized regex for XML context tag matching with DoS protections.
 * - Limits matching to elevated context tags only
 * - Guards against exponential backtracking via bounded iteration
 * - Uses iteration limits instead of regex complexity to prevent DoS
 */
const XML_CONTEXT_TAG_RE = /<([a-z_][a-z0-9_.-]*)[^>]*>[\s\S]*?<\/\1>/gi;

export function splitLeadingXmlContextBlocks(input: string): { contextBlocks: string[]; remaining: string } {
  let remainingText = input;
  let hadLeadingContext = false;
  const contextBlocks: string[] = [];
  let iterations = 0;

  if (remainingText.trimStart().startsWith('<')) {
    remainingText = remainingText.trimStart();
    while (true) {
      // Guard against infinite loops
      if (++iterations > MAX_ITERATIONS) {
        console.warn('Max iterations exceeded while splitting XML context blocks');
        break;
      }

      XML_CONTEXT_TAG_RE.lastIndex = 0;
      const match = XML_CONTEXT_TAG_RE.exec(remainingText);
      if (match?.index !== 0) {
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

      // Enforce maximum block size
      if (matchedText.length > MAX_CONTEXT_BLOCK_LENGTH) {
        console.warn(`Context block exceeds maximum length of ${MAX_CONTEXT_BLOCK_LENGTH} characters`);
        break;
      }

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
