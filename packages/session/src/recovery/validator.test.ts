/* oxlint-disable xss/no-mixed-html -- Test inputs intentionally include mixed HTML/XML */
import { describe, expect, it } from 'vitest';
import { createSessionState, type SessionState } from '../state/schema.js';
import { validateIntegrity } from './validator.js';

function validState(): SessionState {
  return createSessionState('ses-1', 'thread-1');
}

describe('validateIntegrity', () => {
  it('passes a valid minimal state', () => {
    const result = validateIntegrity(validState() as unknown as Record<string, unknown>);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects schema-invalid state (missing required fields)', () => {
    const result = validateIntegrity({ someKey: 'x' });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects timeline violation (updatedAt < createdAt)', () => {
    const state = validState();
    state.createdAt = 2000;
    state.updatedAt = 1000;
    const result = validateIntegrity(state as unknown as Record<string, unknown>);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Timeline violation'))).toBe(true);
  });

  it('warns on out-of-bounds checkpoint messageCount', () => {
    const state = validState();
    // Override checkpoints array — use 5 for messageCount but state has 0 messages
    state.checkpoints = [
      {
        id: 'cp-1',
        createdAt: 1000,
        messageCount: 5,
        toolCallCount: 0,
        threadId: 'thread-1'
      }
    ];
    const result = validateIntegrity(state as unknown as Record<string, unknown>);
    // valid remains true (warning only)
    expect(result.warnings.some(w => w.includes('out of bounds'))).toBe(true);
  });
});
