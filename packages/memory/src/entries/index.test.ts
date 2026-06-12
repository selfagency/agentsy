import { describe, expect, it } from 'vitest';
import { entryImportance, isMemoryEntry } from './index.js';

describe('isMemoryEntry', () => {
  it('accepts a valid fact entry', () => {
    expect(isMemoryEntry({ type: 'fact', content: 'test', confidence: 0.8, kind: 'entity' })).toBe(true);
  });

  it('accepts a qa entry', () => {
    expect(isMemoryEntry({ type: 'qa', question: 'q', answer: 'a' })).toBe(true);
  });

  it('accepts a trace entry', () => {
    expect(isMemoryEntry({ type: 'trace', toolName: 'fs_read', status: 'success', args: {}, result: {} })).toBe(true);
  });

  it('accepts a feedback entry', () => {
    expect(isMemoryEntry({ type: 'feedback', qaId: '1', feedbackText: 'good', feedbackScore: 5 })).toBe(true);
  });

  it('accepts a skill_run entry', () => {
    expect(
      isMemoryEntry({
        type: 'skill_run',
        skillId: '1',
        task: 't',
        resultSummary: 'r',
        successScore: 0.9,
        latencyMs: 100
      })
    ).toBe(true);
  });

  it('rejects null', () => {
    expect(isMemoryEntry(null)).toBe(false);
  });

  it('rejects unknown type', () => {
    expect(isMemoryEntry({ type: 'unknown', content: 'x' })).toBe(false);
  });
});

describe('entryImportance', () => {
  it('returns high for error traces', () => {
    expect(entryImportance({ type: 'trace', toolName: 'x', status: 'error', args: {}, result: {} })).toBe(0.9);
  });

  it('returns confidence for facts', () => {
    expect(entryImportance({ type: 'fact', content: 'x', confidence: 0.75, kind: 'entity' })).toBe(0.75);
  });
});
