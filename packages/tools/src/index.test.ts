import { describe, expect, it } from 'vitest';

import { REPL_TOOLS_PLACEHOLDER } from './index.js';

describe('tools package scaffold', () => {
  it('loads the tools entry module', () => {
    expect(REPL_TOOLS_PLACEHOLDER).toBeDefined();
  });
});
