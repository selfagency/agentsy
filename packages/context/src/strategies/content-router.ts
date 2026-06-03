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

const CODE_HINTS = [
  /```/u,
  /\b(?:function|class|interface|type|const|let|import|export|return)\b/u,
  /\{[^\n]*:\s*[^\n]*\}/u
];

const DIFF_HINTS = [/^diff --git/mu, /^@@/m, /^\+{3} /mu, /^-{3} /mu, /^[+-]\S/mu];

const JSON_HINTS = [/^\s*(?:\[|\{)/u, /"[^"]+"\s*:/u, /\btrue\b|\bfalse\b|\bnull\b/u];

const LOG_HINTS = [
  /^\s*\d{4}-\d{2}-\d{2}/mu,
  /\b(?:error|warn|info|debug|trace)\b/u,
  /\b(?:GET|POST|PUT|PATCH|DELETE)\b/u
];

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

function scoreHints(text: string, hints: readonly RegExp[]): number {
  let score = 0;

  for (const hint of hints) {
    if (hint.test(text)) {
      score += 1;
    }
  }

  return score;
}

function classifyText(text: string): { kind: ContentKind; score: number } {
  const codeScore = scoreHints(text, CODE_HINTS);
  const diffScore = scoreHints(text, DIFF_HINTS);
  const jsonScore = scoreHints(text, JSON_HINTS);
  const logScore = scoreHints(text, LOG_HINTS);

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
