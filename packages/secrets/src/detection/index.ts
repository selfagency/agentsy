/**
 * Secret detection and redaction for tool-call results.
 *
 * Scans text for common API key patterns and replaces them before they
 * leak into conversation history or logs.
 */

/** A detected secret occurrence. */
export interface SecretMatch {
  /** 0-based end index (exclusive) in the original text. */
  end: number;
  /** 0-based start index in the original text. */
  start: number;
  /** Human-readable label (e.g. 'AWS Access Key', 'GitHub Token'). */
  type: string;
  /** The matched secret text. */
  value: string;
}

// ---------------------------------------------------------------------------
// Pattern definitions
// ---------------------------------------------------------------------------

interface Pattern {
  regex: RegExp;
  type: string;
}

const PATTERNS: Pattern[] = [
  // AWS Access Key ID: AKIA followed by 16 alphanumeric chars
  { type: 'AWS Access Key', regex: /AKIA[0-9A-Z]{16}/g },
  // GitHub Personal Access Token: ghp_ followed by 36 alphanumeric chars
  { type: 'GitHub Token', regex: /ghp_[a-zA-Z0-9]{36}/g },
  // GitHub Fine-Grained PAT: github_pat_ followed by 4+4+4+4+12+59 base64 chars with underscores
  { type: 'GitHub Token', regex: /github_pat_[a-zA-Z0-9_]{82}/g },
  // Anthropic API Key: sk-ant- followed by alphanumeric + hyphens (95 chars after prefix)
  { type: 'Anthropic Key', regex: /sk-ant-[a-zA-Z0-9-]{95}/g },
  // Anthropic API Key v2: sk-ant- followed by 3-32 alphanumeric + hyphens (shorter keys)
  { type: 'Anthropic Key', regex: /sk-ant-[a-zA-Z0-9-]{3,32}/g },
  // OpenAI API Key: sk- followed by 48 alphanumeric chars (no hyphens)
  { type: 'OpenAI Key', regex: /sk-[a-zA-Z0-9]{48}/g },
  // OpenAI Project API Key: sk-proj- followed by alphanumeric + underscores (82+ chars)
  { type: 'OpenAI Key', regex: /sk-proj-[a-zA-Z0-9_]{50,}/g }
];

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

/** Scan `text` for known secret patterns and return all matches. */
export function detectSecrets(text: string): SecretMatch[] {
  const matches: SecretMatch[] = [];

  for (const { type, regex } of PATTERNS) {
    // Reset lastIndex for reused global regexes
    regex.lastIndex = 0;

    let m: RegExpExecArray | null;
    while (true) {
      m = regex.exec(text);
      if (m === null) {
        break;
      }
      matches.push({
        type,
        value: m[0],
        start: m.index,
        end: m.index + m[0].length
      });
    }
  }

  // Sort by start position for deterministic output
  matches.sort((a, b) => a.start - b.start);
  return matches;
}

// ---------------------------------------------------------------------------
// Redaction
// ---------------------------------------------------------------------------

/** Replace all detected secrets in `text` with `[REDACTED:TYPE]` placeholders.
 *  Returns the redacted string and the list of matches found. */
export function redactSecrets(text: string): { redacted: string; matches: SecretMatch[] } {
  const matches = detectSecrets(text);
  if (matches.length === 0) {
    return { redacted: text, matches };
  }

  // Process in reverse order so indices stay valid after replacement
  let redacted = text;
  for (const match of matches.toReversed()) {
    const replacement = `[REDACTED:${match.type}]`;
    redacted = redacted.slice(0, match.start) + replacement + redacted.slice(match.end);
  }

  return { redacted, matches };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

import type { HookHandler } from '@agentsy/runtime';

/**
 * Create a post-tool-call hook that detects and redacts secrets from
 * tool-call results.
 *
 * When secrets are found the hook returns `{ transform: redactedResult }`
 * which the runtime should use in place of the original result. The
 * returned HookHandler carries `priority: 100` so it runs early in the
 * post-tool-call chain.
 */
export function createSecretDetectionHook(): HookHandler {
  return {
    id: 'security:secret-detection',
    priority: 100,
    handler: (event: Parameters<HookHandler['handler']>[0]): ReturnType<HookHandler['handler']> => {
      if (event.type !== 'PostToolCall' || typeof event.result !== 'string') {
        return Promise.resolve({ continue: true });
      }

      const { redacted, matches } = redactSecrets(event.result);

      if (matches.length > 0) {
        return Promise.resolve({ transform: redacted });
      }

      return Promise.resolve({ continue: true });
    }
  };
}
