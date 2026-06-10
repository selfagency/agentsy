import { describe, expect, it } from 'vitest';
import { parseSimplePolicy } from './guardrails.js';

describe('parseSimplePolicy', () => {
  it('parses a minimal policy with one rule', () => {
    const yaml = `
version: "1.0"
description: "Test policy"
rules:
  - name: block-shell
    condition: tool.name == "shell_exec"
    action: deny
    severity: high
`;
    const doc = parseSimplePolicy(yaml);
    expect(doc.version).toBe('1.0');
    expect(doc.description).toBe('Test policy');
    expect(doc.rules).toHaveLength(1);
    expect(doc.rules[0]?.name).toBe('block-shell');
    expect(doc.rules[0]?.condition).toBe('tool.name == "shell_exec"');
    expect(doc.rules[0]?.action).toBe('deny');
    expect(doc.rules[0]?.severity).toBe('high');
  });

  it('parses a policy with multiple rules', () => {
    const yaml = `
version: "1.0"
rules:
  - name: allow-readonly
    condition: tool.annotations.readOnlyHint == true
    action: allow
  - name: block-destructive
    condition: tool.annotations.destructiveHint == true
    action: require_approval
    phase: tool-input
`;
    const doc = parseSimplePolicy(yaml);
    expect(doc.rules).toHaveLength(2);
    expect(doc.rules[0]?.name).toBe('allow-readonly');
    expect(doc.rules[0]?.action).toBe('allow');
    expect(doc.rules[1]?.name).toBe('block-destructive');
    expect(doc.rules[1]?.action).toBe('require_approval');
    expect(doc.rules[1]?.phase).toBe('tool-input');
  });

  it('handles empty rule list', () => {
    const yaml = `
version: "1.0"
rules:
`;
    const doc = parseSimplePolicy(yaml);
    expect(doc.rules).toHaveLength(0);
  });

  it('strips quotes from values', () => {
    const yaml = `
version: '1.0'
description: "desc"
rules:
  - name: "test"
    condition: 'true'
    action: log
`;
    const doc = parseSimplePolicy(yaml);
    expect(doc.version).toBe('1.0');
    expect(doc.description).toBe('desc');
    expect(doc.rules[0]?.name).toBe('test');
  });

  it('defaults invalid action to deny', () => {
    const yaml = `
version: "1.0"
rules:
  - name: bad
    condition: "true"
    action: invalid_action
`;
    const doc = parseSimplePolicy(yaml);
    expect(doc.rules[0]?.action).toBe('deny');
  });

  it('defaults missing version to 1.0', () => {
    const yaml = `
description: "no version"
rules:
  - name: test
    condition: "true"
    action: allow
`;
    const doc = parseSimplePolicy(yaml);
    expect(doc.version).toBe('1.0');
  });

  it('ignores comments and blank lines', () => {
    const yaml = `
# This is a comment
version: "1.0"

# Another comment
rules:
  - name: test
    # Inline comment
    condition: "true"
    action: deny
`;
    const doc = parseSimplePolicy(yaml);
    expect(doc.rules).toHaveLength(1);
    expect(doc.rules[0]?.name).toBe('test');
  });
});
