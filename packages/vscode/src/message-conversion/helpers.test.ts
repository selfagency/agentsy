import type { StreamChunk } from '@agentsy/core/processor';
import { describe, expect, it } from 'vitest';

import { mapStreamChunkToVsCode } from './helpers.js';

describe(mapStreamChunkToVsCode, () => {
  it('maps content, thinking and native tool deltas into VS Code parts', () => {
    const chunk: StreamChunk = {
      content: 'Hello',
      nativeToolCallDeltas: [{ argumentsDelta: '{"q":"x"}', id: 'call-1', index: 0, name: 'search' }],
      thinking: 'reason'
    };

    expect(mapStreamChunkToVsCode(chunk)).toStrictEqual([
      { part: { type: 'text', value: 'Hello' } },
      { part: { type: 'text', value: '<think>reason</think>\n' } },
      {
        part: {
          callId: 'call-1',
          index: 0,
          input: '{"q":"x"}',
          name: 'search',
          type: 'tool-call'
        }
      }
    ]);
  });

  it('returns empty list for empty chunks', () => {
    expect(mapStreamChunkToVsCode({})).toStrictEqual([]);
  });

  it('skips falsy content/thinking values', () => {
    const out = mapStreamChunkToVsCode({ content: '', thinking: '' });
    expect(out).toStrictEqual([]);
  });
});
