import { describe, expect, it } from 'vitest';

import { ThinkingParser, createVSCodeCopilotAdapter, createXmlStreamFilter, extractXmlToolCalls, processStream } from './index.js';

describe('scaffold exports', () => {
  it('provides core scaffolding exports', () => {
    const parser = new ThinkingParser();
    const filter = createXmlStreamFilter();
    const calls = extractXmlToolCalls('', new Set<string>());

    expect(parser).toBeDefined();
    expect(filter.write('abc')).toBe('');
    expect(filter.end()).toBe('abc');
    expect(calls).toEqual([]);
  });

  it('exports the generic stream adapter', () => {
    expect(typeof processStream).toBe('function');
  });

  it('exports the VS Code adapter constructor', () => {
    expect(typeof createVSCodeCopilotAdapter).toBe('function');
  });
});
