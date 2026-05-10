import { ELEVATED_CONTEXT_TAG_NAMES } from '../xml-filter/index.js';

// Hardening: Limit max context block size to prevent DoS via catastrophic backtracking
const MAX_CONTEXT_BLOCK_LENGTH = 100_000;
// Hardening: Limit iterations to prevent infinite loops on malformed input
const MAX_ITERATIONS = 100;

/**
 * Safe XML context tag parser that's resistant to regex backtracking DoS attacks.
 * Uses iterative string parsing instead of regex to prevent exponential backtracking.
 */
function findMatchingTagEnd(input: string, tagName: string): number | null {
  const openTagPattern = `<${tagName}`;
  const closeTagPattern = `</${tagName}>`;

  let searchIndex = 0;
  let openTagIndex = input.indexOf(openTagPattern, searchIndex);

  if (openTagIndex !== 0) {
    return null; // First tag must start at position 0
  }

  // Find end of opening tag
  const openTagEnd = input.indexOf('>', openTagIndex);
  if (openTagEnd === -1) {
    return null;
  }

  // Check if this is a self-closing tag (not valid for context blocks)
  if (input[openTagEnd - 1] === '/') {
    return null;
  }

  // Look for matching close tag (simplified parsing - no nesting support needed for context blocks)
  const closeTagStart = input.indexOf(closeTagPattern, openTagEnd);
  if (closeTagStart === -1) {
    return null;
  }

  // Return the end position of the closing tag
  return closeTagStart + closeTagPattern.length;
}

/**
 * Extract the tag name from an opening XML tag.
 * Handles attribute to identify the base tag name.
 */
function extractTagName(openingTag: string): string | null {
  const match = openingTag.match(/^<(\w+)/);
  return match ? match[1] : null;
}

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

      // Safe tag parsing without regex
      if (!remainingText.startsWith('<')) {
        break;
      }

      // Find end of opening tag
      const openTagEnd = remainingText.indexOf('>');
      if (openTagEnd === -1) {
        break;
      }

      const openingTag = remainingText.substring(0, openTagEnd + 1);
      const tagName = extractTagName(openingTag);

      if (!tagName) {
        break;
      }

      if (!ELEVATED_CONTEXT_TAG_NAMES.has(tagName)) {
        break;
      }

      // Find matching end tag position
      const fullBlockEnd = findMatchingTagEnd(remainingText, tagName);
      if (fullBlockEnd === null) {
        break;
      }

      const matchedText = remainingText.substring(0, fullBlockEnd);

      // Enforce maximum block size
      if (matchedText.length > MAX_CONTEXT_BLOCK_LENGTH) {
        console.warn(`Context block exceeds maximum length of ${MAX_CONTEXT_BLOCK_LENGTH} characters`);
        break;
      }

      contextBlocks.push(matchedText.trim());
      remainingText = remainingText.slice(fullBlockEnd).trimStart();
      hadLeadingContext = true;
    }
  }

  return {
    contextBlocks,
    remaining: hadLeadingContext ? remainingText : input,
  };
}
