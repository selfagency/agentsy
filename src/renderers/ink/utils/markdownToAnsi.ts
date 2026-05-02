import { getCachedAnsi } from './tokenCache.js';

export interface MarkdownOptions {
  syntaxHighlight?: boolean;
}

export function hasMarkdownSyntax(s: string): boolean {
  const sample = s.slice(0, 500);
  return /[#*_`]/.test(sample);
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
