import { describe, expect, it } from 'vitest';

import { retry } from './index.js';

describe('retry', () => {
  it('returns the operation result when it succeeds on the first attempt', async () => {
    await expect(retry(async () => 'ok')).resolves.toBe('ok');
  });
});
