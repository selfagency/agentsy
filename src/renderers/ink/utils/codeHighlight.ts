import { getCachedAnsi } from './tokenCache.js';

export async function highlightCode(code: string, lang?: string): Promise<string> {
  try {
    const { highlight, supportsLanguage } = await import('cli-highlight');
    const options = lang && supportsLanguage(lang) ? { language: lang } : {};
    const cacheKey = `${lang ?? ''}::${code}`;
    return getCachedAnsi(cacheKey, () => highlight(code, options));
  } catch {
    return code;
  }
}

const CODE_FENCE_RE = /```(\w*)\n([\s\S]*?)```/g;

export async function highlightCodeFences(content: string): Promise<string> {
  const matches: Array<{ full: string; lang: string; code: string }> = [];

  let match: RegExpExecArray | null;
  CODE_FENCE_RE.lastIndex = 0;
  while ((match = CODE_FENCE_RE.exec(content)) !== null) {
    matches.push({ full: match[0] ?? '', lang: match[1] ?? '', code: match[2] ?? '' });
  }

  if (matches.length === 0) return content;

  let result = content;
  for (const { full, lang, code } of matches) {
    const highlighted = await highlightCode(code, lang || undefined);
    result = result.replace(full, highlighted);
  }

  return result;
}
