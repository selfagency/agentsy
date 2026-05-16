import { describe, expect, it, vi } from "vitest";

import {
  ToolCallDeltaAccumulator,
  accumulateToolCallDeltas,
  toVSCodeToolCallPart,
} from "./tool-call-lifecycle.js";

describe(toVSCodeToolCallPart, () => {
  it("maps processor tool_call part to VS Code-style tool call payload", () => {
    const part = toVSCodeToolCallPart({
      call: {
        format: "native-json",
        id: "call_abc",
        name: "lookup",
        parameters: { q: "weather" },
      },
      state: "input-complete",
      type: "tool_call",
    });

    expect(part).toStrictEqual({
      callId: "call_abc",
      input: { q: "weather" },
      name: "lookup",
    });
  });
});

describe(ToolCallDeltaAccumulator, () => {
  it("accumulates deltas and finalizes valid JSON inputs", () => {
    const accumulator = new ToolCallDeltaAccumulator();
    accumulateToolCallDeltas(accumulator, {
      argumentsDelta: '{"q":',
      id: "call_1",
      index: 0,
      name: "lookup",
      type: "tool_call_delta",
    });
    accumulateToolCallDeltas(accumulator, {
      argumentsDelta: '"x"}',
      index: 0,
      name: "lookup",
      type: "tool_call_delta",
    });

    expect(accumulator.finalize()).toStrictEqual([
      {
        callId: "call_1",
        input: { q: "x" },
        name: "lookup",
      },
    ]);
  });

  it("repairs malformed deltas when finalize is called", () => {
    const accumulator = new ToolCallDeltaAccumulator();
    const onWarning = vi.fn();

    accumulateToolCallDeltas(accumulator, {
      argumentsDelta: '{"q":"abc"',
      index: 0,
      name: "lookup",
      type: "tool_call_delta",
    });

    const finalized = accumulator.finalize({ onWarning });
    expect(finalized[0]?.input).toStrictEqual({ q: "abc" });
    expect(onWarning).not.toHaveBeenCalled();
  });
});
