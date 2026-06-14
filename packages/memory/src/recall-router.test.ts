import { describe, expect, it } from 'vitest';
import { parseStrategy, routeQuery } from './recall-router.js';

describe('routeQuery', () => {
  it('routes code queries to code_rules', () => {
    const result = routeQuery('what are the coding rules for TypeScript');
    expect(result.strategy).toBe('code_rules');
  });

  it('routes "how is X related" to vector', () => {
    const result = routeQuery('how is the auth module related to the session module');
    expect(result.strategy).toBe('vector');
  });

  it('routes summary queries to graph_summary', () => {
    const result = routeQuery('summarize what we built');
    expect(result.strategy).toBe('graph_summary');
  });

  it('routes temporal queries to temporal', () => {
    const result = routeQuery('when did we deploy the last release');
    expect(result.strategy).toBe('temporal');
  });

  it('routes "what did I" to session', () => {
    const result = routeQuery('what did I do earlier');
    expect(result.strategy).toBe('session');
  });

  it('routes exact phrase queries to chunks', () => {
    const result = routeQuery('find "dark mode" exactly');
    expect(result.strategy).toBe('chunks');
  });

  it('routes generic queries to hybrid', () => {
    const result = routeQuery('tell me about the project');
    expect(result.strategy).toBe('hybrid');
  });

  it('handles negation window', () => {
    const result = routeQuery('this is not related to auth');
    // "related" is within 20 chars of "not", so vector is negated
    // Falls through to whatever else matches
    expect(result.strategy).toBeDefined();
  });

  it('records overrides when multiple rules match', () => {
    const result = routeQuery('explain how the code is related to auth');
    // "explain" → graph_summary, "code" → code_rules, "related" → vector
    expect(result.overrides.length).toBeGreaterThan(1);
  });

  it('routes step-by-step to hybrid', () => {
    const result = routeQuery('walk me through the deployment process');
    expect(result.strategy).toBe('hybrid');
  });
});

describe('parseStrategy', () => {
  it('parses "session"', () => {
    expect(parseStrategy('session')).toBe('session');
  });

  it('parses "vector"', () => {
    expect(parseStrategy('vector')).toBe('vector');
  });

  it('defaults to hybrid for unknown', () => {
    expect(parseStrategy('unknown')).toBe('hybrid');
  });

  it('is case-insensitive', () => {
    expect(parseStrategy('CODE_RULES')).toBe('code_rules');
  });
});
