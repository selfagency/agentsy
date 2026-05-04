import { describe, expect, it } from 'vitest';

import {
  formatXmlLikeResponseForDisplay,
  sanitizeNonStreamingModelOutput,
} from './index.js';

describe('core exports', () => {
  it('provides formatting exports', () => {
    expect(typeof formatXmlLikeResponseForDisplay).toBe('function');
    expect(typeof sanitizeNonStreamingModelOutput).toBe('function');
  });
});
