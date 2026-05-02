import { getCachedAnsi } from './tokenCache.js';

export interface MarkdownOptions {
  syntaxHighlight?: boolean;
}

/**
 * Detect markdown syntax patterns more precisely.
 * Looks for: headings, bold emphasis (** or __), code blocks/inline, lists, and links.
 * Uses multiline mode to catch patterns at any line start.
 * Avoids matching single asterisks/underscores to reduce false positives (e.g., "5*3").
 */
export function hasMarkdownSyntax(s: string): boolean {
  const sample = s.slice(0, 500);
  // Patterns: headings (#), lists (-, *), bold emphasis (**, __), code (`, ```), links, ordered lists
  return /^#{1,6}\s|^[-*]\s|\*\*|__|```|`[^`]|\[[^\]]+\]\([^)]+\)|^\d+\./m.test(sample);
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
