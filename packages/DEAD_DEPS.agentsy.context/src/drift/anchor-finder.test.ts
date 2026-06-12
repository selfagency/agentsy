import { describe, expect, it } from 'vitest';

import { findAnchors } from './anchor-finder.js';

describe('findAnchors', () => {
  it('identifies tool calls as anchors', () => {
    const anchors = findAnchors([
      { role: 'user', content: 'Fetch the latest data.' },
      { role: 'assistant', content: 'I will fetch it now.', toolUse: { name: 'query_db', args: {} } }
    ]);

    expect(anchors.some(anchor => anchor.type === 'tool-call')).toBe(true);
  });

  it('identifies user directives as anchors', () => {
    const anchors = findAnchors([
      { role: 'user', content: 'Use the new API endpoint.' },
      { role: 'assistant', content: 'Switching now.' }
    ]);

    expect(anchors.some(anchor => anchor.type === 'directive')).toBe(true);
  });

  it('does not anchor mundane exchanges', () => {
    const anchors = findAnchors([
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' }
    ]);

    expect(anchors).toHaveLength(0);
  });
});
