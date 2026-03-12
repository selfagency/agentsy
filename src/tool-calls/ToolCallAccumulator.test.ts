import { describe, expect, it } from 'vitest';

import { LLMStreamProcessor } from '../processor/LLMStreamProcessor.js';
import { ToolCallAccumulator } from './ToolCallAccumulator.js';

describe('ToolCallAccumulator', () => {
  describe('addDelta / flush', () => {
    it('assembles a single tool call from sequential argument deltas', () => {
      const acc = new ToolCallAccumulator();
      acc.addDelta({ index: 0, name: 'get_weather', id: 'call_1' });
      acc.addDelta({ index: 0, argumentsDelta: '{"lo' });
      acc.addDelta({ index: 0, argumentsDelta: 'cation":' });
      acc.addDelta({ index: 0, argumentsDelta: '"Paris"}' });

      const calls = acc.flush();
      expect(calls).toHaveLength(1);
      expect(calls[0]).toEqual({ id: 'call_1', name: 'get_weather', arguments: { location: 'Paris' } });
    });

    it('handles name arriving in a separate delta from arguments', () => {
      const acc = new ToolCallAccumulator();
      acc.addDelta({ index: 0, id: 'call_abc' });
      acc.addDelta({ index: 0, name: 'search' });
      acc.addDelta({ index: 0, argumentsDelta: '{"q":"hello"}' });

      const calls = acc.flush();
      expect(calls).toHaveLength(1);
      expect(calls[0]?.name).toBe('search');
      expect(calls[0]?.arguments).toEqual({ q: 'hello' });
    });

    it('accumulates multiple parallel tool calls by index', () => {
      const acc = new ToolCallAccumulator();
      acc.addDelta({ index: 0, name: 'read_file', id: 'c0', argumentsDelta: '{"path":' });
      acc.addDelta({ index: 1, name: 'write_file', id: 'c1', argumentsDelta: '{"path":' });
      acc.addDelta({ index: 0, argumentsDelta: '"a.ts"}' });
      acc.addDelta({ index: 1, argumentsDelta: '"b.ts"}' });

      const calls = acc.flush();
      expect(calls).toHaveLength(2);

      const read = calls.find((c) => c.name === 'read_file');
      const write = calls.find((c) => c.name === 'write_file');
      expect(read?.arguments).toEqual({ path: 'a.ts' });
      expect(write?.arguments).toEqual({ path: 'b.ts' });
    });

    it('repairs incomplete JSON at flush time', () => {
      const acc = new ToolCallAccumulator();
      acc.addDelta({ index: 0, name: 'action' });
      // Intentionally missing closing brace.
      acc.addDelta({ index: 0, argumentsDelta: '{"key":"val"' });

      const calls = acc.flush();
      expect(calls).toHaveLength(1);
      // Repaired JSON should recover the partial object.
      expect(calls[0]?.arguments).toEqual({ key: 'val' });
    });

    it('returns empty arguments for a call whose name is set but JSON cannot be repaired', () => {
      const acc = new ToolCallAccumulator();
      acc.addDelta({ index: 0, name: 'broken' });
      acc.addDelta({ index: 0, argumentsDelta: 'not json at all' });

      const calls = acc.flush();
      expect(calls).toHaveLength(1);
      expect(calls[0]?.name).toBe('broken');
      expect(calls[0]?.arguments).toEqual({});
    });

    it('skips entries with no name during flush', () => {
      const acc = new ToolCallAccumulator();
      // Delta with only argument data but no name — should be ignored.
      acc.addDelta({ index: 0, argumentsDelta: '{"x":1}' });

      const calls = acc.flush();
      expect(calls).toHaveLength(0);
    });

    it('does not include id when provider did not supply one', () => {
      const acc = new ToolCallAccumulator();
      acc.addDelta({ index: 0, name: 'tool', argumentsDelta: '{}' });

      const calls = acc.flush();
      expect(calls).toHaveLength(1);
      expect('id' in (calls[0] ?? {})).toBe(false);
    });
  });

  describe('getCompletedCalls', () => {
    it('returns calls with valid complete JSON without requiring flush', () => {
      const acc = new ToolCallAccumulator();
      acc.addDelta({ index: 0, name: 'fn' });
      acc.addDelta({ index: 0, argumentsDelta: '{"a":1}' });
      // index 1 is still incomplete
      acc.addDelta({ index: 1, name: 'fn2', argumentsDelta: '{"b":' });

      const completed = acc.getCompletedCalls();
      expect(completed).toHaveLength(1);
      expect(completed[0]?.name).toBe('fn');
    });

    it('does not modify internal state (calls still flushed later)', () => {
      const acc = new ToolCallAccumulator();
      acc.addDelta({ index: 0, name: 'fn', argumentsDelta: '{"a":1}' });
      acc.getCompletedCalls(); // peek
      acc.addDelta({ index: 0, argumentsDelta: '' }); // additional empty delta

      const flushed = acc.flush();
      expect(flushed).toHaveLength(1);
    });
  });

  describe('reset', () => {
    it('clears all state so subsequent flush returns empty', () => {
      const acc = new ToolCallAccumulator();
      acc.addDelta({ index: 0, name: 'fn', argumentsDelta: '{"a":1}' });
      acc.reset();
      expect(acc.flush()).toHaveLength(0);
    });
  });
});

describe('LLMStreamProcessor — native tool call accumulation', () => {
  it('emits accumulated native tool calls on done chunk', () => {
    const processor = new LLMStreamProcessor();
    const received: Array<{ name: string; parameters: Record<string, unknown> }> = [];
    processor.on('tool_call', (call) => received.push({ name: call.name, parameters: call.parameters }));

    processor.process({
      nativeToolCallDeltas: [{ index: 0, name: 'get_time', id: 'c1', argumentsDelta: '{"tz":' }],
    });
    processor.process({
      nativeToolCallDeltas: [{ index: 0, argumentsDelta: '"UTC"}' }],
      done: true,
    });

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual({ name: 'get_time', parameters: { tz: 'UTC' } });
  });

  it('emits accumulated calls via flush() when done flag is on flush path', () => {
    const processor = new LLMStreamProcessor();
    const received: string[] = [];
    processor.on('tool_call', (call) => received.push(call.name));

    processor.process({
      nativeToolCallDeltas: [{ index: 0, name: 'calculate', argumentsDelta: '{"x":42}' }],
    });
    // flush without done chunk
    processor.flush();

    expect(received).toContain('calculate');
  });

  it('sets format to native-json on emitted calls', () => {
    const processor = new LLMStreamProcessor();
    const formats: string[] = [];
    processor.on('tool_call', (call) => formats.push(call.format));

    processor.process({
      nativeToolCallDeltas: [{ index: 0, name: 'fn', argumentsDelta: '{}' }],
      done: true,
    });

    expect(formats).toEqual(['native-json']);
  });

  it('handles mixed XML and native tool calls in same stream', () => {
    const processor = new LLMStreamProcessor({ knownTools: new Set(['xml_tool']) });
    const names: string[] = [];
    processor.on('tool_call', (call) => names.push(`${call.format}:${call.name}`));

    processor.process({ content: '<xml_tool><a>1</a></xml_tool>' });
    processor.process({
      nativeToolCallDeltas: [{ index: 0, name: 'native_fn', argumentsDelta: '{"b":2}' }],
      done: true,
    });

    expect(names).toContain('bare-xml:xml_tool');
    expect(names).toContain('native-json:native_fn');
  });

  it('respects accumulateNativeToolCalls: false option', () => {
    const processor = new LLMStreamProcessor({ accumulateNativeToolCalls: false });
    const received: string[] = [];
    processor.on('tool_call', (call) => received.push(call.name));

    processor.process({
      nativeToolCallDeltas: [{ index: 0, name: 'fn', argumentsDelta: '{"x":1}' }],
      done: true,
    });

    expect(received).toHaveLength(0);
  });

  it('resets accumulator state on processor reset', () => {
    const processor = new LLMStreamProcessor();
    processor.process({
      nativeToolCallDeltas: [{ index: 0, name: 'old_fn', argumentsDelta: '{"a":1}' }],
    });
    processor.reset();

    const received: string[] = [];
    processor.on('tool_call', (call) => received.push(call.name));
    processor.process({
      nativeToolCallDeltas: [{ index: 0, name: 'new_fn', argumentsDelta: '{"b":2}' }],
      done: true,
    });

    expect(received).toEqual(['new_fn']);
  });
});
