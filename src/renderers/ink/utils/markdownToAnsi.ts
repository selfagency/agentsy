import { getCachedAnsi } from './tokenCache.js';

export function hasMarkdownSyntax(s: string): boolean {
  const sample = s.slice(0, 500);
  return /[#*_`]/.test(sample);
}

export async function markdownToAnsi(content: string): Promise<string> {
  if (!hasMarkdownSyntax(content)) {
    return content;
  }
  try {
    const cliMarkdown = (await import('cli-markdown')).default;
    return getCachedAnsi(content, (c: string) => cliMarkdown(c));
  } catch {
    return content;
  }
}
