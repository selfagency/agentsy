/**
 * Inline ignore directives for guardrail scanners.
 *
 * Inspired by entro-scan's `# entro-scan: ignore` and lint-style suppression.
 *
 * Supports two patterns:
 * - `agentsy: guardrails-ignore` — suppress ALL detections for the current line
 * - `agentsy: guardrails-ignore-next-line` — suppress ALL detections for the NEXT line
 *
 * ## Examples
 *
 * ```typescript
 * const apiKey = 'sk-abc123...'; // agentsy: guardrails-ignore
 * ```
 *
 * ```python
 * # agentsy: guardrails-ignore-next-line
 * password = "hunter2"
 * ```
 *
 * ## Supported comment syntaxes
 *
 * - `//` — JavaScript/TypeScript/Go/Rust/C/C++ single-line
 * - `#` — Python/Shell/YAML/Ruby/Perl config
 * - `--` — SQL/Lua comments
 * - `<!-- -->` — HTML/XML comments (on the same or preceding line)
 * - `;` — INI/Assembly comments
 */

// =============================================================================
// Comment patterns
// =============================================================================

const IGNORE_LINE_PATTERN = /agentsy:\s*guardrails-ignore\s*$/m;
const IGNORE_NEXT_LINE_PATTERN = /agentsy:\s*guardrails-ignore-next-line\s*$/m;

// =============================================================================
// Parsing
// =============================================================================

export interface IgnoreDirectives {
  /** Lines (1-based) where `agentsy: guardrails-ignore` was found. */
  readonly ignoreLine: Set<number>;
  /** Lines (1-based) where `agentsy: guardrails-ignore-next-line` was found. */
  readonly ignoreNextLine: Set<number>;
}

/**
 * Parse ignore directives from a multi-line input string.
 *
 * @param input — The full input string.
 * @returns Sets of line numbers (1-based) for each directive type.
 */
export function parseIgnoreDirectives(input: string): IgnoreDirectives {
  const lines = input.split('\n');
  const ignoreLine = new Set<number>();
  const ignoreNextLine = new Set<number>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string;
    const lineNum = i + 1; // 1-based

    if (IGNORE_LINE_PATTERN.test(line)) {
      ignoreLine.add(lineNum);
    }

    if (IGNORE_NEXT_LINE_PATTERN.test(line)) {
      ignoreNextLine.add(lineNum);
    }
  }

  return { ignoreLine, ignoreNextLine };
}

/**
 * Check if a detection at a given line should be suppressed.
 *
 * @param detections — Parsed ignore directives from `parseIgnoreDirectives`.
 * @param line — The 1-based line number where the detection was found.
 * @returns True if the detection should be suppressed.
 */
export function shouldIgnore(directives: IgnoreDirectives, line: number): boolean {
  // Same-line ignore
  if (directives.ignoreLine.has(line)) {
    return true;
  }
  // Next-line ignore (directive on the previous line)
  if (directives.ignoreNextLine.has(line - 1)) {
    return true;
  }
  return false;
}
