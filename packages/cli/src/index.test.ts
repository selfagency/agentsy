import { describe, expect, it } from 'vitest';

import { name } from './index.js';

describe('cli package scaffold', () => {
  it('exports the package name', () => {
    expect(name).toBe('cli');
  });
});
