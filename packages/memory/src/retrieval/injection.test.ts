import { describe, expect, it } from 'vitest';

import { formatMemoryContextXml, injectMemoryContext } from './injection.js';

describe('memory injection', () => {
  it('formats sanitized memory XML blocks', () => {
    const xml = formatMemoryContextXml([
      {
        content: '<script>alert(1)</script> OAuth PKCE',
        id: 'r1',
        scope: 'project',
        score: 0.93,
        title: 'Auth'
      }
    ]);

    expect(xml).toContain('<memory_context>');
    expect(xml).not.toContain('<script>');
    expect(xml).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('injects deduped memory context before remaining prompt text', () => {
    const existing = '<memory_context><memory_item id="a">old</memory_item></memory_context>\nPrompt body';
    const incoming = '<memory_context><memory_item id="b">new</memory_item></memory_context>';

    const output = injectMemoryContext(existing, incoming);

    expect(output).toContain('id="b"');
    expect(output).toContain('Prompt body');
  });
});
