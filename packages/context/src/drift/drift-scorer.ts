export interface CoherenceSignal {
  contradictionScore: number;
  repetitionScore: number;
  rotScore: number;
}

export interface CoherenceResult {
  coherence: number;
  signals: CoherenceSignal;
}

export interface DriftMessageLike {
  content: string;
  role: string;
}

function normalize(content: string): string {
  return content.trim().toLowerCase();
}

function tokenize(content: string): Set<string> {
  return new Set(
    normalize(content)
      .split(/\W+/u)
      .map(token => token.trim())
      .filter(token => token.length > 0)
  );
}

function similarity(left: string, right: string): number {
  const leftTokens = tokenize(left);
  const rightTokens = tokenize(right);

  if (leftTokens.size === 0 && rightTokens.size === 0) {
    return 1;
  }

  let intersection = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      intersection += 1;
    }
  }

  const union = leftTokens.size + rightTokens.size - intersection;
  return union === 0 ? 1 : intersection / union;
}

function detectContradiction(previous: string, current: string): number {
  const prev = normalize(previous);
  const next = normalize(current);

  if (prev === next) {
    return 0;
  }

  if (prev.includes('actually') || next.includes('actually')) {
    return 0.4;
  }

  if (similarity(previous, current) < 0.2) {
    return 0.5;
  }

  return 0.1;
}

function detectRepetition(messages: readonly DriftMessageLike[]): number {
  if (messages.length < 2) {
    return 0;
  }

  let repeatedPairs = 0;
  let totalPairs = 0;

  for (let index = 1; index < messages.length; index += 1) {
    const previous = messages[index - 1];
    const current = messages[index];

    if (previous === undefined || current === undefined) {
      continue;
    }

    const sim = similarity(previous.content, current.content);
    totalPairs += 1;

    if (sim >= 0.8) {
      repeatedPairs += 1;
    }
  }

  return totalPairs === 0 ? 0 : repeatedPairs / totalPairs;
}

export function scoreCoherence(messages: readonly DriftMessageLike[]): number {
  if (messages.length < 2) {
    return 1;
  }

  let contradictionScore = 0;
  let contradictionChecks = 0;

  for (let index = 1; index < messages.length; index += 1) {
    const previous = messages[index - 1];
    const current = messages[index];

    if (previous === undefined || current === undefined) {
      continue;
    }

    contradictionScore += detectContradiction(previous.content, current.content);
    contradictionChecks += 1;

    const lowerCurrent = normalize(current.content);
    if (lowerCurrent.startsWith('actually') || lowerCurrent.startsWith('no,') || lowerCurrent.startsWith('instead')) {
      contradictionScore += 0.3;
    }
  }

  const contradictionSignal = contradictionChecks === 0 ? 0 : contradictionScore / contradictionChecks;
  const repetitionSignal = detectRepetition(messages);
  const rotSignal = repetitionSignal * 0.25;

  const penalty = Math.min(0.85, contradictionSignal * 0.6 + repetitionSignal * 0.25 + rotSignal * 0.15);
  return Math.max(0, 1 - penalty);
}
