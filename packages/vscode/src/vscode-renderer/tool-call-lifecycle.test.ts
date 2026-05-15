import { describe, expect, it, vi } from 'vitest';
import { ToolCallDeltaAccumulator, accumulateToolCallDeltas, toVSCodeToolCallPart } from './tool-call-lifecycle.js';

describe('toVSCodeToolCallPart', () => {
  it('maps processor tool_call part to VS Code-style tool call payload', () => {
    const part = toVSCodeToolCallPart({
      type: 'tool_call',
      state: 'input-complete',
      call: {
        id: 'call_abc',
        name: 'lookup',
        parameters: { q: 'weather' },
        format: 'native-json'
      }
    });

    expect(part).toEqual({
      callId: 'call_abc',
      name: 'lookup',
      input: { q: 'weather' }
    });
  });
});

describe('ToolCallDeltaAccumulator', () => {
  it('accumulates deltas and finalizes valid JSON inputs', () => {
    const accumulator = new ToolCallDeltaAccumulator();
    accumulateToolCallDeltas(accumulator, {
      type: 'tool_call_delta',
      index: 0,
      id: 'call_1',
      name: 'lookup',
      argumentsDelta: '{"q":'
    });
    accumulateToolCallDeltas(accumulator, {
      type: 'tool_call_delta',
      index: 0,
      name: 'lookup',
      argumentsDelta: '"x"}'
    });

    expect(accumulator.finalize()).toEqual([
      {
        callId: 'call_1',
        name: 'lookup',
        input: { q: 'x' }
      }
    ]);
  });

  it('repairs malformed deltas when finalize is called', () => {
    const accumulator = new ToolCallDeltaAccumulator();
    const onWarning = vi.fn();

    accumulateToolCallDeltas(accumulator, {
      type: 'tool_call_delta',
      index: 0,
      name: 'lookup',
      argumentsDelta: '{"q":"abc"'
    });

    const finalized = accumulator.finalize({ onWarning });
    expect(finalized[0]?.input).toEqual({ q: 'abc' });
    expect(onWarning).not.toHaveBeenCalled();
  });
});
