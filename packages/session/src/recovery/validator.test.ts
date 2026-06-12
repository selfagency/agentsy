/* oxlint-disable xss/no-mixed-html -- Test inputs intentionally include mixed HTML/XML */
import { describe, expect, it } from 'vitest';
import { createSessionState, type SessionState } from '../state/schema.js';
import { validateIntegrity } from './validator.js';

function validState(): SessionState {
  return createSessionState('ses-1', 'thread-1');
}

function stateWithMessages(messages: { role: string; content: string }[]): SessionState {
  const state = validState();
  state.messages = messages as SessionState['messages'];
  return state;
}

describe('validateIntegrity', () => {
  it('passes a valid minimal state', () => {
    const result = validateIntegrity(validState());
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
    const result = validateIntegrity(state);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Timeline violation'))).toBe(true);
  });

  it('warns on out-of-bounds checkpoint messageCount', () => {
    const state = validState();
    state.checkpoints = [
      {
        id: 'cp-1',
        createdAt: 1000,
        messageCount: 5,
        toolCallCount: 0,
        threadId: 'thread-1'
      }
    ];
    const result = validateIntegrity(state);
    expect(result.warnings.some(w => w.includes('out of bounds'))).toBe(true);
  });

  it('warns on role alternation violation (user→user)', () => {
    const state = stateWithMessages([
      { role: 'user', content: 'hi' },
      { role: 'user', content: 'hello again' }
    ]);
    const result = validateIntegrity(state);
    expect(result.warnings.some(w => w.includes('expected role'))).toBe(true);
  });

  it('accepts valid user→assistant alternation', () => {
    const state = stateWithMessages([
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' }
    ]);
    const result = validateIntegrity(state);
    expect(result.warnings).toHaveLength(0);
  });

  it('accepts system messages anywhere in alternation', () => {
    const state = stateWithMessages([
      { role: 'system', content: 'be helpful' },
      { role: 'user', content: 'hi' },
      { role: 'system', content: 'be concise' },
      { role: 'assistant', content: 'ok' }
    ]);
    const result = validateIntegrity(state);
    expect(result.warnings).toHaveLength(0);
  });

  it('handles tool messages after assistant', () => {
    const state = stateWithMessages([
      { role: 'user', content: 'call tool' },
      { role: 'assistant', content: 'calling' },
      { role: 'tool', content: 'result' }
    ]);
    const result = validateIntegrity(state);
    expect(result.warnings).toHaveLength(0);
  });

  it('warns on checkpoint timestamp exceeding updatedAt', () => {
    const state = validState();
    state.checkpoints = [
      {
        id: 'cp-1',
        createdAt: state.updatedAt + 10_000,
        messageCount: 0,
        toolCallCount: 0,
        threadId: 'thread-1'
      }
    ];
    const result = validateIntegrity(state);
    expect(result.warnings.some(w => w.includes('exceeds state updatedAt'))).toBe(true);
  });

  it('warns on checkpoint timestamp preceding createdAt', () => {
    const state = validState();
    state.checkpoints = [
      {
        id: 'cp-1',
        createdAt: state.createdAt - 10_000,
        messageCount: 0,
        toolCallCount: 0,
        threadId: 'thread-1'
      }
    ];
    const result = validateIntegrity(state);
    expect(result.warnings.some(w => w.includes('precedes state createdAt'))).toBe(true);
  });

  it('warns on duplicate checkpoint timestamps', () => {
    const state = validState();
    state.checkpoints = [
      {
        id: 'cp-1',
        createdAt: 1000,
        messageCount: 0,
        toolCallCount: 0,
        threadId: 'thread-1'
      },
      {
        id: 'cp-2',
        createdAt: 1000,
        messageCount: 0,
        toolCallCount: 0,
        threadId: 'thread-1'
      }
    ];
    const result = validateIntegrity(state);
    expect(result.warnings.some(w => w.includes('Duplicate checkpoint'))).toBe(true);
  });

  it('skips messages without role in alternation check', () => {
    const state = validState();
    state.messages = [
      { role: 'user', content: 'hi' },
      { role: 'user', content: 'hello' }
    ];
    const result = validateIntegrity(state);
    expect(result.warnings.some(w => w.includes('expected role'))).toBe(true);
  });
});
