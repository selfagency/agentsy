import { describe, expect, it } from 'vitest';
import {
  buildAnthropicToolResult,
  buildGeminiToolResult,
  buildOpenAIToolResult,
  buildToolResultMessage,
} from './buildToolResultMessage.js';
import type { XmlToolCall } from './extractXmlToolCalls.js';

const baseCall: XmlToolCall = {
  name: 'get_weather',
  parameters: { city: 'NYC' },
  format: 'native-json',
  id: 'call_abc123',
};

const callWithoutId: XmlToolCall = {
  name: 'get_weather',
  parameters: { city: 'NYC' },
  format: 'bare-xml',
};

describe('buildToolResultMessage', () => {
  it('builds provider-agnostic tool result message with string result', () => {
    const msg = buildToolResultMessage(baseCall, 'Sunny, 72°F');
    expect(msg).toEqual({
      role: 'tool',
      tool_call_id: 'call_abc123',
      name: 'get_weather',
      content: 'Sunny, 72°F',
    });
  });

  it('serializes object result to JSON string', () => {
    const msg = buildToolResultMessage(baseCall, { temp: 72, unit: 'F' });
    expect(msg.content).toBe('{"temp":72,"unit":"F"}');
  });

  it('falls back to tool name as id when id is absent', () => {
    const msg = buildToolResultMessage(callWithoutId, 'Cloudy');
    expect(msg.tool_call_id).toBe('get_weather');
  });

  it('accepts isError option without modifying content in base format', () => {
    const msg = buildToolResultMessage(baseCall, 'Tool failed', { isError: true });
    expect(msg.content).toBe('Tool failed');
    expect(msg.role).toBe('tool');
  });
});

describe('buildAnthropicToolResult', () => {
  it('wraps result in Anthropic tool_result block inside user turn', () => {
    const result = buildAnthropicToolResult(baseCall, 'Sunny');
    expect(result.role).toBe('user');
    expect(result.content).toHaveLength(1);
    expect(result.content[0]).toMatchObject({
      type: 'tool_result',
      tool_use_id: 'call_abc123',
      content: 'Sunny',
    });
    expect(result.content[0].is_error).toBeUndefined();
  });

  it('sets is_error when isError: true', () => {
    const result = buildAnthropicToolResult(baseCall, 'Something went wrong', { isError: true });
    expect(result.content[0].is_error).toBe(true);
  });

  it('serializes object result', () => {
    const result = buildAnthropicToolResult(baseCall, { data: [1, 2] });
    expect(result.content[0].content).toBe('{"data":[1,2]}');
  });

  it('falls back to tool name when id absent', () => {
    const result = buildAnthropicToolResult(callWithoutId, 'ok');
    expect(result.content[0].tool_use_id).toBe('get_weather');
  });
});

describe('buildOpenAIToolResult', () => {
  it('builds OpenAI tool message', () => {
    const result = buildOpenAIToolResult(baseCall, 'Hot and sunny');
    expect(result).toEqual({
      role: 'tool',
      tool_call_id: 'call_abc123',
      content: 'Hot and sunny',
    });
  });

  it('serializes object result', () => {
    const result = buildOpenAIToolResult(baseCall, { forecast: 'rain' });
    expect(result.content).toBe('{"forecast":"rain"}');
  });

  it('falls back to tool name when id absent', () => {
    const result = buildOpenAIToolResult(callWithoutId, 'ok');
    expect(result.tool_call_id).toBe('get_weather');
  });
});

describe('buildGeminiToolResult', () => {
  it('builds Gemini functionResponse in user turn', () => {
    const result = buildGeminiToolResult(baseCall, 'Warm');
    expect(result.role).toBe('user');
    expect(result.parts).toHaveLength(1);
    expect(result.parts[0].functionResponse).toMatchObject({
      name: 'get_weather',
      response: { output: 'Warm' },
    });
  });

  it('uses error field when isError: true', () => {
    const result = buildGeminiToolResult(baseCall, 'API timeout', { isError: true });
    expect(result.parts[0].functionResponse.response).toEqual({ error: 'API timeout' });
  });

  it('serializes object result in output field', () => {
    const result = buildGeminiToolResult(baseCall, { temp: 68 });
    expect(result.parts[0].functionResponse.response).toEqual({ output: '{"temp":68}' });
  });
});
