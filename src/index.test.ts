import { describe, expect, it } from 'vitest';

import { ThinkingParser, createXmlStreamFilter, extractXmlToolCalls } from './index.js';

describe('scaffold exports', () => {
  it('provides core scaffolding exports', () => {
    const parser = new ThinkingParser();
    const filter = createXmlStreamFilter();
    const calls = extractXmlToolCalls('', new Set<string>());

    expect(parser).toBeDefined();
    expect(filter.write('abc')).toBe('abc');
    expect(calls).toEqual([]);
  });
});
