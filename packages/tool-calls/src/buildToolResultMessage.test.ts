import { describe, expect, it } from 'vitest';
import { buildToolResultMessage } from './buildToolResultMessage.js';

describe('buildToolResultMessage', () => {
  it('builds result messages from a full XmlToolCall shape', () => {
    const message = buildToolResultMessage(
      {
        id: 'call_123',
        name: 'search',
        parameters: { q: 'agentsy' },
        format: 'bare-xml',
      },
      { ok: true },
    );

    expect(message).toEqual({
      role: 'tool',
      tool_call_id: 'call_123',
      name: 'search',
      content: '{"ok":true}',
    });
  });

  it('accepts a minimal native reference shape', () => {
    const message = buildToolResultMessage(
      {
        id: 'native_1',
        name: 'lookup_weather',
      },
      'sunny',
    );

    expect(message).toEqual({
      role: 'tool',
      tool_call_id: 'native_1',
      name: 'lookup_weather',
      content: 'sunny',
    });
  });

  it('falls back to tool name when id is missing', () => {
    const message = buildToolResultMessage(
      {
        name: 'lookup_weather',
      },
      { city: 'Berlin' },
      { isError: true },
    );

    expect(message).toEqual({
      role: 'tool',
      tool_call_id: 'lookup_weather',
      name: 'lookup_weather',
      content: '{"city":"Berlin"}',
      is_error: true,
    });
  });
});
