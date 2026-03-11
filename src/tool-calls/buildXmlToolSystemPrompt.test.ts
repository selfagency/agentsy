import { describe, expect, it } from 'vitest';

import { buildXmlToolSystemPrompt } from './buildXmlToolSystemPrompt.js';

describe('buildXmlToolSystemPrompt', () => {
  it('returns empty string when no tools are provided', () => {
    expect(buildXmlToolSystemPrompt([])).toBe('');
  });

  it('renders xml examples and rules for provided tools', () => {
    const prompt = buildXmlToolSystemPrompt([
      {
        name: 'search_files',
        description: 'Search files',
        inputSchema: {
          properties: {
            query: { type: 'string', description: 'search term' },
          },
          required: ['query'],
        },
      },
    ]);

    expect(prompt).toContain('# Tool Use');
    expect(prompt).toContain('<search_files>');
    expect(prompt).toContain('<query>search term</query>');
    expect(prompt).toContain('no markdown fences');
  });
});
