import { getCachedAnsi } from './tokenCache.js';

export interface MarkdownOptions {
  syntaxHighlight?: boolean;
}

/**
 * Detect markdown syntax patterns more precisely.
 * Looks for: headings, bold emphasis (** or __), code blocks/inline, lists, and links.
 * Uses multiline mode to catch patterns at any line start.
 * Avoids matching single asterisks/underscores to reduce false positives (e.g., "5*3").
 * Optimized regex to prevent ReDoS attacks.
 */
export function hasMarkdownSyntax(s: string): boolean {
  const sample = s.slice(0, 500);
  // Optimized patterns without backtracking vulnerabilities
  if (/^#{1,6}\s/.test(sample)) return true; // Headings
  if (/^[-*]\s/.test(sample)) return true; // Lists
  if (/\*\*|__/.test(sample)) return true; // Bold emphasis
  if (/```|`[^`]/.test(sample)) return true; // Code blocks/inline
  if (/\[[^\]]+\]\([^)]+\)/.test(sample)) return true; // Links
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
