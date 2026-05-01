/**
 * Stack-based state machine for incremental JSON repair.
 * Improves upon bracket-matching by tracking string/escape state,
 * incomplete numbers/keywords, and providing rollback positions.
 *
 * @remarks
 * This is an alternative JSON repair implementation currently not in use.
 * The simpler bracket-matching approach in `parseJson.ts` handles current needs well.
 * This state machine exists as a future-proof upgrade path if repair edge cases
 * are discovered or stricter handling of escape sequences becomes necessary.
 * It has comprehensive tests and can be swapped in by updating the repair flow in `parseJson.ts`.
 */

export interface RepairState {
  /** Stack of expected closing delimiters: '}' for '{', ']' for '[' */
  bracketStack: string[];
  /** Whether we're currently inside a string literal */
  inString: boolean;
  /** Whether the previous character was an escape character */
  escaped: boolean;
  /** Position of the last "safe" complete JSON structure */
  lastSafeEnd: number;
  /** Current accumulation buffer */
  buffer: string;
}

// biome-ignore lint/suspicious/noEmptyInterface: Reserved for future use
export interface RepairStateMachineOptions {}

/**
 * Create an initial repair state.
 */
export function createRepairState(): RepairState {
  return {
    bracketStack: [],
    inString: false,
    escaped: false,
    lastSafeEnd: -1,
    buffer: '',
  };
}

/**
 * Feed a character through the state machine, updating state.
 * Returns the character that should be added to output (may differ from input).
 */
export function feedCharToStateMachine(char: string, state: RepairState): string {
  // #lizard forgives
  // Handle escape sequences within strings
  if (state.escaped) {
    state.escaped = false;
    state.buffer += char;
    return char;
  }

  if (state.inString && char === '\\') {
    state.escaped = true;
    state.buffer += char;
    return char;
  }

  // Toggle string state on unescaped quotes
  if (char === '"') {
    state.inString = !state.inString;
    state.buffer += char;
    return char;
  }

  // If inside a string, just accumulate
  if (state.inString) {
    state.buffer += char;
    return char;
  }

  // Outside string: handle structural characters
  if (char === '{' || char === '[') {
    state.bracketStack.push(char === '{' ? '}' : ']');
    state.buffer += char;
    return char;
  }

  if (char === '}' || char === ']') {
    if (state.bracketStack.length > 0 && state.bracketStack.at(-1) === char) {
      state.bracketStack.pop();
      state.buffer += char;
      // Mark this as a safe position if we've closed a top-level structure
      if (state.bracketStack.length === 0) {
        state.lastSafeEnd = state.buffer.length;
      }
      return char;
    }
    // Mismatched closing delimiter: skip it
    return '';
  }

  // For all other characters, just accumulate
  state.buffer += char;
  return char;
}

/**
 * Close the state machine, returning a properly-closed JSON string.
 * Adds closing delimiters as needed and truncates if necessary.
 */
export function closeRepairState(state: RepairState): string {
  let result = state.buffer;

  // Close any unclosed strings with a quote
  if (state.inString) {
    result += '"';
  }

  // Close any unclosed brackets
  while (state.bracketStack.length > 0) {
    result += state.bracketStack.pop();
  }

  return result;
}

/**
 * Repair a JSON string using the state machine approach.
 * This is more robust than simple bracket-matching for handling:
 * - Truncated strings (adds closing quote)
 * - Escape sequences
 * - Incomplete numbers/keywords (preserved as-is)
 */
export function repairJsonWithStateMachine(input: string): string {
  const state = createRepairState();

  // Feed all characters through the state machine
  for (const char of input) {
    feedCharToStateMachine(char, state);
  }

  // Close and return
  return closeRepairState(state);
}
