import { describe, expect, it, vi } from 'vitest';
import { toMistralMessages, type MistralOutboundMessage } from './mistral.js';

describe('toMistralMessages', () => {
  it('keeps system messages text-only and drops non-text system parts', () => {
    const onWarning = vi.fn();
    const messages: MistralOutboundMessage[] = [
      {
        role: 'system',
        parts: [
          { type: 'text', text: 'You are concise.' },
          { type: 'image', mimeType: 'image/png', data: 'abc' },
        ],
      },
    ];

    const result = toMistralMessages(messages, { onWarning });

    expect(result).toEqual([{ role: 'system', content: 'You are concise.' }]);
    expect(onWarning).toHaveBeenCalled();
  });

  it('maps user multimodal content to Mistral content parts', () => {
    const messages: MistralOutboundMessage[] = [
      {
        role: 'user',
        parts: [
          { type: 'text', text: 'What is in this image?' },
          { type: 'image', mimeType: 'image/png', data: 'iVBORw0KGgo=' },
        ],
      },
    ];

    const result = toMistralMessages(messages);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ role: 'user' });
    const content = result[0] && 'content' in result[0] ? result[0].content : undefined;
    expect(Array.isArray(content)).toBe(true);
  });

  it('emits assistant tool calls and tool results with normalized ids', () => {
    const messages: MistralOutboundMessage[] = [
      {
        role: 'assistant',
        parts: [{ type: 'tool-call', callId: 'call_xyz', name: 'search', input: { q: 'weather' } }],
      },
      {
        role: 'user',
        parts: [{ type: 'tool-result', callId: 'call_xyz', content: '{"temp":72}' }],
      },
    ];

    const result = toMistralMessages(messages);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ role: 'assistant' });
    if (result[0]?.role === 'assistant') {
      expect(result[0].toolCalls?.[0]?.id).toMatch(/^[A-Za-z0-9]{9}$/);
    }
    expect(result[1]).toMatchObject({ role: 'tool' });
    if (result[1]?.role === 'tool' && result[0]?.role === 'assistant') {
      expect(result[1].toolCallId).toBe(result[0].toolCalls?.[0]?.id);
    }
  });

  it('uses custom normalizeToolCallId when provided', () => {
    const result = toMistralMessages(
      [
        {
          role: 'assistant',
          parts: [{ type: 'tool-call', callId: 'orig-id', name: 'lookup', input: {} }],
        },
      ],
      {
        normalizeToolCallId: () => 'ABC123XYZ',
      },
    );

    if (result[0]?.role !== 'assistant') {
      throw new Error('Expected assistant message');
    }

    expect(result[0].toolCalls?.[0]?.id).toBe('ABC123XYZ');
  });
});
