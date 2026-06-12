import { describe, expect, it } from 'vitest';

import { scoreCoherence } from './drift-scorer.js';

describe('scoreCoherence', () => {
  it('returns a high score for coherent conversation flow', () => {
    const messages = [
      { role: 'user', content: 'What is 2 + 2?' },
      { role: 'assistant', content: '2 + 2 = 4.' },
      { role: 'user', content: 'What is 4 + 4?' },
      { role: 'assistant', content: '4 + 4 = 8.' }
    ];

    expect(scoreCoherence(messages)).toBeGreaterThan(0.9);
  });

  it('returns a lower score when the assistant contradicts itself', () => {
    const messages = [
      { role: 'user', content: 'The result is 5.' },
      { role: 'assistant', content: 'Understood, the result is 5.' },
      { role: 'assistant', content: 'Actually, the result is 10.' }
    ];

    expect(scoreCoherence(messages)).toBeLessThan(0.75);
  });

  it('returns a lower score for repetitive context rot', () => {
    const messages = [
      { role: 'user', content: 'Explain recursion.' },
      { role: 'assistant', content: 'Recursion is when a function calls itself.' },
      { role: 'user', content: 'Explain recursion again.' },
      { role: 'assistant', content: 'Recursion is when a function calls itself again.' }
    ];

    expect(scoreCoherence(messages)).toBeLessThan(0.85);
  });
});
