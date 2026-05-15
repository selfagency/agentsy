export interface ParseJsonOptions {
  selectMostComprehensive?: boolean;
  repairIncomplete?: boolean;
  maxJsonDepth?: number;
  maxJsonKeys?: number;
}

export const DEFAULT_MAX_JSON_DEPTH = 64;
export const DEFAULT_MAX_JSON_KEYS = 10_000;

function stripCodeFences(text: string): string {
  return text.replaceAll(/```(?:json)?\s*([\s\S]*?)```/gi, '$1').trim();
}

function processBracketChar(
  char: string,
  stack: string[],
  start: number,
  i: number,
  text: string,
  candidates: string[]
): number {
  if (char === '{' || char === '[') {
    const newStart = stack.length === 0 ? i : start;
    stack.push(char === '{' ? '}' : ']');
    return newStart;
  }

  if ((char === '}' || char === ']') && stack.length > 0) {
    if (stack.at(-1) === char) {
      stack.pop();
      if (stack.length === 0 && start >= 0) {
        candidates.push(text.slice(start, i + 1));
        return -1;
      }
    }
  }
  return start;
}

function extractJsonCandidates(text: string): string[] {
  const candidates: string[] = [];
  const stack: string[] = [];
  let start = -1;
  let inString = false;
  let escaped = false;
  let i = 0;

  for (const char of text) {
    if (escaped) {
      escaped = false;
      i++;
      continue;
    }
    if (inString && char === '\\') {
      escaped = true;
      i++;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      i++;
      continue;
    }
    if (!inString) {
      start = processBracketChar(char, stack, start, i, text, candidates);
    }
    i++;
  }

  return candidates;
}

function processRepairBracket(char: string, stack: string[]): string | null {
  if (char === '{') {
    stack.push('}');
    return char;
  }
  if (char === '[') {
    stack.push(']');
    return char;
  }
  if (stack.length === 0) return null;

  let result = '';
  while (stack.length > 0 && stack.at(-1) !== char) {
    result += stack.pop();
  }
  if (stack.at(-1) === char) {
    result += char;
    stack.pop();
  }
  return result;
}

function consumeRepairChar(
  char: string,
  state: { inString: boolean; escaped: boolean; stack: string[] }
): { append: string; skip: boolean } {
  if (state.escaped) {
    state.escaped = false;
    return { append: char, skip: false };
  }

  if (char === '\\') {
    state.escaped = true;
    return { append: char, skip: false };
  }

  if (char === '"') {
    state.inString = !state.inString;
    return { append: char, skip: false };
  }

  if (state.inString) {
    return { append: char, skip: false };
  }

  if (char === '{' || char === '[' || char === '}' || char === ']') {
    const addition = processRepairBracket(char, state.stack);
    return addition === null ? { append: '', skip: true } : { append: addition, skip: false };
  }

  return { append: char, skip: false };
}

function tryRepairCandidate(text: string): string | null {
  const start = text.search(/[[{]/);
  if (start === -1) {
    return null;
  }

  const trimmed = text.slice(start).trim();
  const stack: string[] = [];
  let repaired = '';
  const state = { inString: false, escaped: false, stack };

  for (const char of trimmed) {
    const { append, skip } = consumeRepairChar(char, state);
    if (skip) {
      continue;
    }
    repaired += append;
  }

  if (state.inString) {
    return null;
  }

  while (stack.length > 0) {
    repaired += stack.pop();
  }

  return repaired;
}

// #lizard forgives
function tryParseRepaired(normalized: string, maxJsonDepth: number, maxJsonKeys: number): unknown {
  const repaired = tryRepairCandidate(normalized);
  if (!repaired) return null;
  try {
    const parsed = JSON.parse(repaired);
    return exceedsJsonLimits(parsed, maxJsonDepth, maxJsonKeys) ? null : parsed;
  } catch {
    return null;
  }
}

function measureComprehensiveness(value: unknown): number {
  let keyCount = 0;
  let depth = 0;

  function walk(node: unknown, currentDepth: number): void {
    depth = Math.max(depth, currentDepth);
    if (Array.isArray(node)) {
      for (const item of node) {
        walk(item, currentDepth + 1);
      }
      return;
    }
    if (node && typeof node === 'object') {
      const entries = Object.entries(node as Record<string, unknown>);
      keyCount += entries.length;
      for (const [, val] of entries) {
        walk(val, currentDepth + 1);
      }
    }
  }

  walk(value, 1);
  return keyCount * 100 + depth;
}

function exceedsJsonLimits(value: unknown, maxDepth: number, maxKeys: number): boolean {
  if (maxDepth <= 0 && maxKeys <= 0) {
    return false;
  }

  let keyCount = 0;
  let exceeded = false;

  function walk(node: unknown, depth: number): void {
    if (exceeded) {
      return;
    }

    if (maxDepth > 0 && depth > maxDepth) {
      exceeded = true;
      return;
    }

    if (Array.isArray(node)) {
      for (const item of node) {
        walk(item, depth + 1);
      }
      return;
    }

    if (node && typeof node === 'object') {
      const entries = Object.entries(node as Record<string, unknown>);
      keyCount += entries.length;
      if (maxKeys > 0 && keyCount > maxKeys) {
        exceeded = true;
        return;
      }

      for (const [, child] of entries) {
        walk(child, depth + 1);
      }
    }
  }

  walk(value, 1);
  return exceeded;
}

function collectParsedCandidates(normalized: string, maxJsonDepth: number, maxJsonKeys: number): unknown[] {
  const parsedValues: unknown[] = [];
  for (const candidate of extractJsonCandidates(normalized)) {
    try {
      const parsed = JSON.parse(candidate);
      if (!exceedsJsonLimits(parsed, maxJsonDepth, maxJsonKeys)) {
        parsedValues.push(parsed);
      }
    } catch {
      // Ignore malformed candidates and continue scanning.
    }
  }
  return parsedValues;
}

function selectBestCandidate(parsedValues: unknown[], selectMostComprehensive: boolean): unknown {
  if (!selectMostComprehensive || parsedValues.length === 1) {
    return parsedValues[0] ?? null;
  }
  return parsedValues.slice().sort((a, b) => measureComprehensiveness(b) - measureComprehensiveness(a))[0] ?? null;
}

/**
 * Extracts and parses the best JSON value from mixed text.
 * Strips markdown code fences, selects the most comprehensive candidate,
 * and optionally attempts repair of incomplete JSON.
 *
 * @returns The parsed value, or `null` if no valid JSON is found.
 *          Never throws — malformed candidates are silently skipped.
 */
export function parseJson<T = unknown>(text: string, options: ParseJsonOptions = {}): T | null {
  const normalized = stripCodeFences(text);
  const selectMostComprehensive = options.selectMostComprehensive ?? true;
  const maxJsonDepth = options.maxJsonDepth ?? DEFAULT_MAX_JSON_DEPTH;
  const maxJsonKeys = options.maxJsonKeys ?? DEFAULT_MAX_JSON_KEYS;

  const parsedValues = collectParsedCandidates(normalized, maxJsonDepth, maxJsonKeys);

  if (parsedValues.length > 0) {
    return selectBestCandidate(parsedValues, selectMostComprehensive) as T;
  }

  if (options.repairIncomplete) {
    return tryParseRepaired(normalized, maxJsonDepth, maxJsonKeys) as T | null;
  }

  return null;
}
