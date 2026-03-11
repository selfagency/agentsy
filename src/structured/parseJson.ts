export interface ParseJsonOptions {
  selectMostComprehensive?: boolean;
  repairIncomplete?: boolean;
}

function stripCodeFences(text: string): string {
  return text.replace(/```(?:json)?\s*([\s\S]*?)```/gi, '$1').trim();
}

function extractJsonCandidates(text: string): string[] {
  const candidates: string[] = [];
  const stack: string[] = [];
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === '{' || char === '[') {
      if (stack.length === 0) {
        start = i;
      }
      stack.push(char === '{' ? '}' : ']');
      continue;
    }

    if ((char === '}' || char === ']') && stack.length > 0) {
      const expected = stack[stack.length - 1];
      if (expected === char) {
        stack.pop();
        if (stack.length === 0 && start >= 0) {
          candidates.push(text.slice(start, i + 1));
          start = -1;
        }
      }
    }
  }

  return candidates;
}

function tryRepairCandidate(text: string): string | null {
  const start = text.search(/[\[{]/);
  if (start === -1) {
    return null;
  }

  const trimmed = text.slice(start).trim();
  const stack: string[] = [];
  let repaired = '';
  let inString = false;
  let escaped = false;

  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\') {
      repaired += char;
      escaped = true;
      continue;
    }

    if (char === '"') {
      repaired += char;
      inString = !inString;
      continue;
    }

    if (inString) {
      repaired += char;
      continue;
    }

    if (char === '{') {
      stack.push('}');
      repaired += char;
    } else if (char === '[') {
      stack.push(']');
      repaired += char;
    } else if (char === '}' || char === ']') {
      if (stack.length === 0) {
        continue;
      }

      while (stack.length > 0 && stack[stack.length - 1] !== char) {
        repaired += stack.pop();
      }

      if (stack.length > 0 && stack[stack.length - 1] === char) {
        repaired += char;
        stack.pop();
      }
    } else {
      repaired += char;
    }
  }

  if (inString) {
    return null;
  }

  while (stack.length > 0) {
    repaired += stack.pop();
  }

  return repaired;
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

export function parseJson(text: string, options: ParseJsonOptions = {}): unknown | null {
  const normalized = stripCodeFences(text);
  const selectMostComprehensive = options.selectMostComprehensive ?? true;

  const parsedValues: unknown[] = [];
  for (const candidate of extractJsonCandidates(normalized)) {
    try {
      parsedValues.push(JSON.parse(candidate));
    } catch {
      // Ignore malformed candidates and continue scanning.
    }
  }

  if (parsedValues.length > 0) {
    if (!selectMostComprehensive || parsedValues.length === 1) {
      return parsedValues[0] ?? null;
    }

    return parsedValues
      .slice()
      .sort((a, b) => measureComprehensiveness(b) - measureComprehensiveness(a))[0] ?? null;
  }

  if (options.repairIncomplete) {
    const repaired = tryRepairCandidate(normalized);
    if (repaired) {
      try {
        return JSON.parse(repaired);
      } catch {
        return null;
      }
    }
  }

  return null;
}
