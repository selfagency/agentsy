import { describe, expect, it } from 'vitest';
import { decideSandboxTrigger } from './dynamic-trigger.js';

describe('decideSandboxTrigger', () => {
  it('should honor forceMode if provided', () => {
    expect(decideSandboxTrigger({ forceMode: 'virtual' }).mode).toBe('virtual');
    expect(decideSandboxTrigger({ forceMode: 'container' }).mode).toBe('container');
    expect(decideSandboxTrigger({ forceMode: 'none' }).mode).toBe('none');
  });

  it('should return none for readOnly operations', () => {
    const result = decideSandboxTrigger({ readOnly: true });
    expect(result.mode).toBe('none');
    expect(result.reason).toContain('read-only');
  });

  it('should prefer container for untrusted input if available', () => {
    const result = decideSandboxTrigger({ trustLevel: 'untrusted', containerAvailable: true });
    expect(result.mode).toBe('container');
  });

  it('should REFUSE untrusted input if container is not available', () => {
    const result = decideSandboxTrigger({ trustLevel: 'untrusted', containerAvailable: false });
    expect(result.mode).toBe('none');
    expect(result.reason).toContain('REFUSED');
  });

  it('should default to virtual sandbox', () => {
    const result = decideSandboxTrigger({});
    expect(result.mode).toBe('virtual');
  });
});
