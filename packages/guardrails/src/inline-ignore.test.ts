import { describe, expect, it } from 'vitest';

import { parseIgnoreDirectives, shouldIgnore } from './inline-ignore.js';

// =============================================================================
// parseIgnoreDirectives
// =============================================================================

describe('parseIgnoreDirectives', () => {
  it('finds no directives in clean input', () => {
    const input = 'const x = 1;\nconst y = 2;\n';
    const result = parseIgnoreDirectives(input);
    expect(result.ignoreLine.size).toBe(0);
    expect(result.ignoreNextLine.size).toBe(0);
  });

  it('detects same-line ignore directive (TS // syntax)', () => {
    const input = "const key = 'sk-abc123'; // agentsy: guardrails-ignore";
    const result = parseIgnoreDirectives(input);
    expect(result.ignoreLine.has(1)).toBe(true);
  });

  it('detects ignore-next-line directive', () => {
    const input = '// agentsy: guardrails-ignore-next-line\nconst key = "secret";';
    const result = parseIgnoreDirectives(input);
    expect(result.ignoreNextLine.has(1)).toBe(true);
  });

  it('detects Python-style # comment', () => {
    const input = '# agentsy: guardrails-ignore\npassword = "hunter2"';
    const result = parseIgnoreDirectives(input);
    expect(result.ignoreLine.has(1)).toBe(true);
  });

  it('detects SQL-style -- comment', () => {
    const input = '-- agentsy: guardrails-ignore\nSELECT * FROM users;';
    const result = parseIgnoreDirectives(input);
    expect(result.ignoreLine.has(1)).toBe(true);
  });

  it('handles multiple directives across lines', () => {
    const input = [
      '// agentsy: guardrails-ignore-next-line',
      'const key = "abc";',
      '# agentsy: guardrails-ignore',
      'const token = "xyz";'
    ].join('\n');

    const result = parseIgnoreDirectives(input);
    expect(result.ignoreNextLine.has(1)).toBe(true);
    expect(result.ignoreLine.has(3)).toBe(true);
  });

  it('ignores partial matches (only full directive triggers)', () => {
    const input = '// my-agentsy: guardrails-ignore-something-else\nconst x = 1;';
    const result = parseIgnoreDirectives(input);
    expect(result.ignoreLine.size).toBe(0);
    expect(result.ignoreNextLine.size).toBe(0);
  });
});

// =============================================================================
// shouldIgnore
// =============================================================================

describe('shouldIgnore', () => {
  it('suppresses detection on ignored line', () => {
    const input = "const key = 'secret'; // agentsy: guardrails-ignore";
    const result = parseIgnoreDirectives(input);
    expect(shouldIgnore(result, 1)).toBe(true);
  });

  it('suppresses detection on next line after ignore-next-line', () => {
    const input = '// agentsy: guardrails-ignore-next-line\nconst key = "secret";';
    const result = parseIgnoreDirectives(input);
    expect(shouldIgnore(result, 2)).toBe(true);
  });

  it('does not suppress detection on non-adjacent line', () => {
    const input = '// agentsy: guardrails-ignore-next-line\n\nconst key = "secret";';
    const result = parseIgnoreDirectives(input);
    // Line 3 is NOT line 2 (which would be the next line after line 1)
    expect(shouldIgnore(result, 3)).toBe(false);
  });

  it('does not suppress detection when no directive present', () => {
    const input = 'const key = "secret";';
    const result = parseIgnoreDirectives(input);
    expect(shouldIgnore(result, 1)).toBe(false);
  });

  it('handles both directive types simultaneously', () => {
    const input = [
      '// agentsy: guardrails-ignore-next-line',
      'const key = "abc"; // agentsy: guardrails-ignore',
      'const token = "xyz";'
    ].join('\n');

    const result = parseIgnoreDirectives(input);
    // Line 2 has both ignore-next-line from line 1 AND ignore on itself
    expect(shouldIgnore(result, 2)).toBe(true);
    // Line 3 is NOT suppressed (no ignore-next-line on line 2 after its own ignore)
    expect(shouldIgnore(result, 3)).toBe(false);
  });
});
