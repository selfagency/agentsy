import { describe, expect, it } from 'vitest';
import type { StreamChunk } from '@agentsy/core/processor';
import { mapStreamChunkToVsCode } from './helpers.js';

describe('mapStreamChunkToVsCode', () => {
  it('maps content, thinking and native tool deltas into VS Code parts', () => {
    const chunk: StreamChunk = {
      content: 'Hello',
      thinking: 'reason',
      nativeToolCallDeltas: [{ index: 0, id: 'call-1', name: 'search', argumentsDelta: '{"q":"x"}' }]
    };

    expect(mapStreamChunkToVsCode(chunk)).toEqual([
      { part: { type: 'text', value: 'Hello' } },
      { part: { type: 'text', value: '<think>reason</think>\n' } },
      {
        part: {
          type: 'tool-call',
          index: 0,
          callId: 'call-1',
          name: 'search',
          input: '{"q":"x"}'
        }
      }
    ]);
  });

  it('returns empty list for empty chunks', () => {
    expect(mapStreamChunkToVsCode({})).toEqual([]);
  });

  it('skips falsy content/thinking values', () => {
    const out = mapStreamChunkToVsCode({ content: '', thinking: '' });
    expect(out).toEqual([]);
  });
});
