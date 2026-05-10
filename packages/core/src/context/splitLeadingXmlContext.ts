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
  const tagNameRegex = /^<(\w+)/;
  const match = tagNameRegex.exec(openingTag);
  return match ? match[1] : null;
}

/**
 * Extract a single leading context block from the text if it exists.
 * Returns the previous extraction state and whether a block was found.
 */
function extractNextContextBlock(
  remainingText: string,
  previousContextBlocks: string[],
  previousIterations: number,
): {
  newContextBlocks: string[];
  newRemainingText: string;
  hasLeadingContext: boolean;
  shouldContinue: boolean;
  iterations: number;
} {
  let contextBlocks = previousContextBlocks;
  let text = remainingText;
  let iterations = previousIterations;

  // Guard against infinite loops
  if (++iterations > MAX_ITERATIONS) {
    console.warn('Max iterations exceeded while splitting XML context blocks');
    return {
      newContextBlocks: contextBlocks,
      newRemainingText: text,
      hasLeadingContext: true,
      shouldContinue: false,
      iterations,
    };
  }

  // Safe tag parsing without regex
  if (!text.startsWith('<')) {
    return {
      newContextBlocks: contextBlocks,
      newRemainingText: text,
      hasLeadingContext: contextBlocks.length > 0,
      shouldContinue: false,
      iterations,
    };
  }

  // Find end of opening tag
  const openTagEnd = text.indexOf('>');
  if (openTagEnd === -1) {
    return {
      newContextBlocks: contextBlocks,
      newRemainingText: text,
      hasLeadingContext: contextBlocks.length > 0,
      shouldContinue: false,
      iterations,
    };
  }

  const openingTag = text.substring(0, openTagEnd + 1);
  const tagName = extractTagName(openingTag);

  if (!tagName) {
    return {
      newContextBlocks: contextBlocks,
      newRemainingText: text,
      hasLeadingContext: contextBlocks.length > 0,
      shouldContinue: false,
      iterations,
    };
  }

  if (!ELEVATED_CONTEXT_TAG_NAMES.has(tagName)) {
    return {
      newContextBlocks: contextBlocks,
      newRemainingText: text,
      hasLeadingContext: contextBlocks.length > 0,
      shouldContinue: false,
      iterations,
    };
  }

  // Find matching end tag position
  const fullBlockEnd = findMatchingTagEnd(text, tagName);
  if (fullBlockEnd === null) {
    return {
      newContextBlocks: contextBlocks,
      newRemainingText: text,
      hasLeadingContext: contextBlocks.length > 0,
      shouldContinue: false,
      iterations,
    };
  }

  const matchedText = text.substring(0, fullBlockEnd);

  // Enforce maximum block size
  if (matchedText.length > MAX_CONTEXT_BLOCK_LENGTH) {
    console.warn(`Context block exceeds maximum length of ${MAX_CONTEXT_BLOCK_LENGTH} characters`);
    return {
      newContextBlocks: contextBlocks,
      newRemainingText: text,
      hasLeadingContext: contextBlocks.length > 0,
      shouldContinue: false,
      iterations,
    };
  }

  contextBlocks = [...contextBlocks, matchedText.trim()];
  text = text.slice(fullBlockEnd).trimStart();

  return {
    newContextBlocks: contextBlocks,
    newRemainingText: text,
    hasLeadingContext: true,
    shouldContinue: true,
    iterations,
  };
}

export function splitLeadingXmlContextBlocks(input: string): { contextBlocks: string[]; remaining: string } {
  let remainingText = input;
  let contextBlocks: string[] = [];
  let iterations = 0;

  if (!remainingText.trimStart().startsWith('<')) {
    return {
      contextBlocks,
      remaining: input,
    };
  }

  remainingText = remainingText.trimStart();

  while (true) {
    const result = extractNextContextBlock(remainingText, contextBlocks, iterations);
    remainingText = result.newRemainingText;
    contextBlocks = result.newContextBlocks;
    iterations = result.iterations;

    if (!result.shouldContinue) {
      break;
    }
  }

  const hadLeadingContext = contextBlocks.length > 0;

  return {
    contextBlocks,
    remaining: hadLeadingContext ? remainingText : input,
  };
}
