import { getCachedAnsi } from './tokenCache.js';

export interface MarkdownOptions {
  syntaxHighlight?: boolean;
}

/**
 * Detect markdown syntax patterns with ReDoS-safe regex.
 * Looks for: headings, bold emphasis (** or __), code blocks/inline, lists, and links.
 * Uses atomic groups and possessive quantifiers where possible to prevent catastrophic backtracking.
 * Limits sample size to 500 chars to prevent performance issues on very large strings.
 */
export function hasMarkdownSyntax(s: string): boolean {
  const sample = s.slice(0, 500);
  // Atomic patterns: each character class is bounded and non-overlapping
  if (/^#{1,6}\s/.test(sample)) return true; // Headings
  if (/^[-*]\s/.test(sample)) return true; // Lists
  if (/\*\*|__/.test(sample)) return true; // Bold emphasis
  if (/```|`[^`]/.test(sample)) return true; // Code blocks/inline
  if (/\[[^\]]{0,200}\]\([^)]{0,200}\)/.test(sample)) return true; // Links with bounded length
  if (/^\d+\./.test(sample)) return true; // Ordered lists
  return false;
}

export async function markdownToAnsi(content: string, options: MarkdownOptions = {}): Promise<string> {
  if (!hasMarkdownSyntax(content)) {
    return content;
  }

  let processed = content;

  if (options.syntaxHighlight) {
    const { highlightCodeFences } = await import('./codeHighlight.js');
    processed = await highlightCodeFences(processed);
  }

  try {
    const cliMarkdown = (await import('cli-markdown')).default;
    return getCachedAnsi(processed, (c: string) => cliMarkdown(c));
  } catch {
    return processed;
  }
}
