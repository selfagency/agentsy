/**
 * Shared prose compression utilities for caveman mode compression.
 * Reduces verbosity while preserving code blocks, inline code, and URLs.
 */

export type CompressionLevel = 'lite' | 'full' | 'ultra';

const LITE_REMOVALS = ['basically', 'actually', 'simply', 'really', 'just', 'generally', 'essentially'];

const FULL_REMOVALS = [...LITE_REMOVALS, 'furthermore', 'additionally', 'however', 'of course'];

const ULTRA_REMOVALS = [...FULL_REMOVALS, 'you should', 'it might be worth', 'you could consider'];

/**
 * Get the appropriate word list for a compression level.
 */
export function getRemovalWords(level: CompressionLevel): readonly string[] {
  switch (level) {
    case 'lite':
      return LITE_REMOVALS;
    case 'full':
      return FULL_REMOVALS;
    case 'ultra':
      return ULTRA_REMOVALS;
  }
}

/**
 * Remove a list of words from the input string, preserving word boundaries.
 */
export function removeWordList(input: string, words: readonly string[]): string {
  let output = input;
  for (const word of words) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    output = output.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), '');
  }

  return output;
}

/**
 * Protect pattern matches by replacing them with placeholders.
 * Used to preserve code blocks, URLs, etc. during compression.
 */
export function protectPattern(
  input: string,
  pattern: RegExp,
  placeholderMap: Map<string, string>,
  nextId: { value: number },
  placeholderPrefix: string
): string {
  return input.replace(pattern, match => {
    const key = `${placeholderPrefix}${nextId.value}__`;
    nextId.value += 1;
    placeholderMap.set(key, match);
    return key;
  });
}

/**
 * Restore protected segments (code blocks, URLs, etc.) after compression.
 */
export function restoreProtectedSegments(input: string, placeholderMap: Map<string, string>): string {
  let output = input;
  for (const [key, value] of placeholderMap.entries()) {
    output = output.replaceAll(key, value);
  }

  return output;
}

/**
 * Core compression algorithm for prose text.
 * Removes filler words, articles (optionally), and normalizes whitespace.
 * Assumes protected segments (code blocks, URLs) have already been replaced with placeholders.
 */
export function compressProse(input: string, level: CompressionLevel): string {
  const removals = getRemovalWords(level);

  let output = removeWordList(input, removals);

  if (level !== 'lite') {
    output = output.replace(/\b(a|an|the)\b/gi, '');
  }

  if (level === 'ultra') {
    output = output
      .replace(/\bin order to\b/gi, 'to')
      .replace(/\bmake sure to\b/gi, 'ensure')
      .replace(/\bthat\b/gi, '');
  }

  output = output
    .replace(/[ \t]+/g, ' ')
    .replace(/\s([,.;:!?])/g, '$1')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ {2,}/g, ' ')
    .trim();

  return output;
}
