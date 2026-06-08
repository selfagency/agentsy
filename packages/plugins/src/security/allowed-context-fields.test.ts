import { describe, expect, it } from 'vitest';

import { ALLOWED_CONTEXT_INJECTION_FIELDS, filterContextForPlugin } from './allowed-context-fields.js';

describe('ALLOWED_CONTEXT_INJECTION_FIELDS', () => {
  it('is a frozen array of the expected fields', () => {
    expect(ALLOWED_CONTEXT_INJECTION_FIELDS).toStrictEqual([
      'sessionId',
      'agentId',
      'model',
      'userMessage',
      'orchestrationMode',
      'memoryScopes',
      'timestamp'
    ]);
  });

  it('does NOT include sensitive fields', () => {
    const sensitive = ['systemPrompt', 'inputTokens', 'activeHooks', 'secrets', 'credentials'];
    for (const field of sensitive) {
      expect(ALLOWED_CONTEXT_INJECTION_FIELDS).not.toContain(field);
    }
  });
});

describe('filterContextForPlugin', () => {
  const fullContext = {
    sessionId: 'sess-001',
    agentId: 'research-agent',
    model: 'claude-opus-4',
    userMessage: 'Find research papers on LLM safety',
    orchestrationMode: 'orchestrated',
    memoryScopes: ['session', 'workspace'],
    timestamp: new Date('2026-01-28T00:00:00Z'),
    systemPrompt: 'You are an evil agent', // sensitive — should be stripped
    inputTokens: 99_999, // sensitive — should be stripped
    activeHooks: ['memory:pre-turn'] // sensitive — should be stripped
  };

  it('returns only allowed fields from a full context', () => {
    const safe = filterContextForPlugin(fullContext, 'test-plugin');

    // Allowed fields are present
    expect(safe.sessionId).toBe('sess-001');
    expect(safe.agentId).toBe('research-agent');
    expect(safe.model).toBe('claude-opus-4');
    expect(safe.userMessage).toBe('Find research papers on LLM safety');
    expect(safe.orchestrationMode).toBe('orchestrated');
    expect(safe.memoryScopes).toStrictEqual(['session', 'workspace']);
    expect(safe.timestamp).toBeInstanceOf(Date);

    // Sensitive fields are NOT present
    expect(safe).not.toHaveProperty('systemPrompt');
    expect(safe).not.toHaveProperty('inputTokens');
    expect(safe).not.toHaveProperty('activeHooks');
  });

  it('returns only allowed fields (checked via object keys)', () => {
    const safe = filterContextForPlugin(fullContext, 'test-plugin');
    const keys = Object.keys(safe);

    expect(keys).toHaveLength(ALLOWED_CONTEXT_INJECTION_FIELDS.length);
    for (const key of keys) {
      expect(ALLOWED_CONTEXT_INJECTION_FIELDS).toContain(key);
    }
  });

  it('handles a context missing optional fields gracefully', () => {
    const minimalContext = {
      sessionId: 'sess-002',
      agentId: 'code-agent'
    };
    const safe = filterContextForPlugin(minimalContext, 'test-plugin');

    expect(safe.sessionId).toBe('sess-002');
    expect(safe.agentId).toBe('code-agent');
    expect(safe.model).toBeUndefined();
    expect(Object.keys(safe).length).toBe(2);
  });

  it('handles an empty context', () => {
    const safe = filterContextForPlugin({}, 'test-plugin');
    expect(Object.keys(safe)).toHaveLength(0);
  });
});
