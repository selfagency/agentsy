export interface ContentProcessor {
  normalize(content: string): string;
  extractCodeBlocks(content: string): string[];
  detectFormat(content: string): 'markdown' | 'text' | 'code' | 'json';
  toSearchableText(content: string): string;
  extractEntities(content: string): string[];
}

const CODE_BLOCK_PATTERN = /```[\s\S]*?```/g;
const ENTITY_PATTERN = /\b[A-Z][A-Za-z0-9]*\b/g;

function normalizeWhitespace(content: string): string {
  return content.replace(/\r\n/g, '\n').trim();
}

function looksLikeJson(content: string): boolean {
  const normalized = normalizeWhitespace(content);
  return (
    (normalized.startsWith('{') && normalized.endsWith('}')) || (normalized.startsWith('[') && normalized.endsWith(']'))
  );
}

function looksLikeCode(content: string): boolean {
  return /\b(function|const|let|class|interface|return|import|export)\b/.test(content);
}

function looksLikeMarkdown(content: string): boolean {
  return /(^#\s)|(```)|(^-\s)|(^\d+\.\s)/m.test(content);
}

export function createContentProcessor(): ContentProcessor {
  return {
    normalize(content: string) {
      return normalizeWhitespace(content);
    },

    extractCodeBlocks(content: string) {
      return content.match(CODE_BLOCK_PATTERN) ?? [];
    },

    detectFormat(content: string) {
      if (looksLikeJson(content)) {
        return 'json';
      }

      if (looksLikeMarkdown(content)) {
        return 'markdown';
      }

      if (looksLikeCode(content)) {
        return 'code';
      }

      return 'text';
    },

    toSearchableText(content: string) {
      if (looksLikeJson(content)) {
        try {
          return JSON.stringify(JSON.parse(content));
        } catch {
          return normalizeWhitespace(content);
        }
      }

      return normalizeWhitespace(content)
        .replace(CODE_BLOCK_PATTERN, ' ')
        .replace(/[`*_#>-]/g, ' ');
    },

    extractEntities(content: string) {
      const candidates = content.match(ENTITY_PATTERN) ?? [];
      return [...new Set(candidates.filter(entity => entity.length >= 3))];
    },
  };
}
