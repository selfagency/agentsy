import { describe, expect, it } from 'vitest';

import { dummy } from './index.js';

describe('tools package scaffold', () => {
  it('loads the tools entry module', () => {
    expect(dummy).toBeDefined();
  });
});
