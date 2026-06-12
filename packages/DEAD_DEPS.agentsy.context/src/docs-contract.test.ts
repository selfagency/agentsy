import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { compressConversation, compressOutput, createManualCompaction, createTokenLedger } from './index.js';

const packageRoot = join(import.meta.dirname, '..');
const readme = readFileSync(join(packageRoot, 'README.md'), 'utf8');

describe('docs drift', () => {
  it('does not mention removed tokenomics APIs', () => {
    expect(readme).not.toContain('createInMemoryTokenManager');
    expect(readme).not.toContain('PacingController');
    expect(readme).not.toContain('requestTokens');
  });

  it('documents actual compressConversation result shape', () => {
    expect(readme).toContain('result.messages');
    expect(readme).not.toContain('result.retained');
  });

  it('exports documented stable APIs', () => {
    expect(typeof compressConversation).toBe('function');
    expect(typeof compressOutput).toBe('function');
    expect(typeof createManualCompaction).toBe('function');
    expect(typeof createTokenLedger).toBe('function');
  });
});
