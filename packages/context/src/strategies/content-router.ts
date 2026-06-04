export type ContentKind = 'code' | 'diff' | 'json' | 'log' | 'mixed' | 'prose';

export interface ContentRoutingMessageLike {
  content?: unknown;
  role?: string;
}

export interface ContentRoute {
  confidence: number;
  kind: ContentKind;
  reasons: string[];
  strategy: 'anchored-iterative' | 'layered-pruning' | 'naive-dropping';
}

const CODE_KEYWORDS = ['function', 'class', 'interface', 'type', 'const', 'let', 'import', 'export', 'return'] as const;
const LOG_KEYWORDS = ['error', 'warn', 'info', 'debug', 'trace'] as const;
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

function hasCodeHint(text: string): boolean {
  if (text.includes('```')) {
    return true;
  }

  return CODE_KEYWORDS.some(keyword => text.includes(keyword));
}

function hasDiffHint(text: string): boolean {
  return (
    text.startsWith('diff --git') ||
    text.startsWith('@@') ||
    text.startsWith('+++ ') ||
    text.startsWith('--- ') ||
    text.startsWith('+') ||
    text.startsWith('-')
  );
}

function hasJsonHint(text: string): boolean {
  const trimmed = text.trimStart();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return true;
  }

  return trimmed.includes('"') && trimmed.includes(':') && /["}]/u.test(trimmed);
}

function hasLogHint(text: string): boolean {
  const trimmed = text.trimStart();
  if (/^\d{4}-\d{2}-\d{2}/u.test(trimmed)) {
    return true;
  }

  const lower = text.toLowerCase();
  return LOG_KEYWORDS.some(keyword => lower.includes(keyword)) || HTTP_METHODS.some(method => text.includes(method));
}

function getText(message: unknown): string {
  if (typeof message === 'string') {
    return message;
  }

  if (typeof message === 'object' && message !== null && 'content' in message) {
    const content = (message as ContentRoutingMessageLike).content;
    return typeof content === 'string' ? content : JSON.stringify(content);
  }

  return JSON.stringify(message);
}

function classifyText(text: string): { kind: ContentKind; score: number } {
  const codeScore = hasCodeHint(text) ? 1 : 0;
  const diffScore = hasDiffHint(text) ? 1 : 0;
  const jsonScore = hasJsonHint(text) ? 1 : 0;
  const logScore = hasLogHint(text) ? 1 : 0;

  const ranked: [ContentKind, number][] = [
    ['diff', diffScore],
    ['json', jsonScore],
    ['log', logScore],
    ['code', codeScore]
  ];

  ranked.sort((left, right) => right[1] - left[1]);

  const [kind, score] = ranked[0] ?? ['prose', 0];
  if (score === 0) {
    return { kind: 'prose', score: 0 };
  }

  return { kind, score };
}

export function routeCompressionStrategy(messages: readonly unknown[]): ContentRoute {
  const counts = new Map<ContentKind, number>();
  let strongest: ContentKind = 'prose';
  let strongestScore = 0;

  for (const message of messages) {
    const text = getText(message);
    const { kind, score } = classifyText(text);
    counts.set(kind, (counts.get(kind) ?? 0) + 1);

    if (score > strongestScore) {
      strongest = kind;
      strongestScore = score;
    }
  }

  const total = Math.max(1, messages.length);
  const diffCount = counts.get('diff') ?? 0;
  const jsonCount = counts.get('json') ?? 0;
  const logCount = counts.get('log') ?? 0;
  const codeCount = counts.get('code') ?? 0;
  const proseCount = counts.get('prose') ?? 0;

  if (diffCount / total >= 0.5) {
    return {
      confidence: diffCount / total,
      kind: 'diff',
      reasons: ['dominant diff markers'],
      strategy: 'anchored-iterative'
    };
  }

  if (jsonCount / total >= 0.5) {
    return {
      confidence: jsonCount / total,
      kind: 'json',
      reasons: ['dominant JSON structure'],
      strategy: 'layered-pruning'
    };
  }

  if (logCount / total >= 0.5) {
    return {
      confidence: logCount / total,
      kind: 'log',
      reasons: ['dominant log patterns'],
      strategy: 'layered-pruning'
    };
  }

  if (codeCount / total >= 0.5) {
    return {
      confidence: codeCount / total,
      kind: 'code',
      reasons: ['dominant code patterns'],
      strategy: 'anchored-iterative'
    };
  }

  return {
    confidence: proseCount / total,
    kind: strongest === 'prose' ? 'prose' : strongest,
    reasons: ['mixed content', 'fallback routing'],
    strategy: (() => {
      if (strongest === 'prose') {
        return 'naive-dropping';
      }

      if (strongest === 'json' || strongest === 'log') {
        return 'layered-pruning';
      }

      return 'anchored-iterative';
    })()
  };
}
