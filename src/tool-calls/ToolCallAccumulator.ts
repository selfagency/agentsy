import type { NativeToolCallDelta } from '../normalizers/types.js';
import { parseJson } from '../structured/parseJson.js';

/** A native (JSON-format) tool call that has been fully assembled from streaming deltas. */
export interface NativeToolCall {
  /** Provider-assigned call ID, present when supplied by the provider (e.g. OpenAI `id` field). */
  id?: string | undefined;
  name: string;
  arguments: Record<string, unknown>;
}

interface PendingCall {
  id?: string | undefined;
  name?: string | undefined;
  argumentsBuffer: string;
}

/**
 * Accumulates incremental native tool call argument deltas from streaming LLM providers
 * (e.g. OpenAI `tool_calls[].function.arguments` deltas, Anthropic `input_json_delta`).
 *
 * Multiple tool calls may arrive in parallel, distinguished by their numeric `index`.
 * Call `addDelta()` for each incoming delta, then either poll `getCompletedCalls()` during
 * streaming (to detect calls whose JSON is already complete) or call `flush()` at stream end
 * to force-complete any pending calls via JSON repair.
 */
export class ToolCallAccumulator {
  private readonly calls = new Map<number, PendingCall>();

  /**
   * Accumulate a streaming delta. Updates the name, id, and/or argument buffer for
   * the call identified by `delta.index`.
   */
  public addDelta(delta: NativeToolCallDelta): void {
    const existing = this.calls.get(delta.index);
    if (existing) {
      if (delta.id !== undefined) {
        existing.id = delta.id;
      }
      if (delta.name !== undefined) {
        existing.name = delta.name;
      }
      if (delta.argumentsDelta !== undefined) {
        existing.argumentsBuffer += delta.argumentsDelta;
      }
    } else {
      const pending: PendingCall = { argumentsBuffer: delta.argumentsDelta ?? '' };
      if (delta.id !== undefined) pending.id = delta.id;
      if (delta.name !== undefined) pending.name = delta.name;
      this.calls.set(delta.index, pending);
    }
  }

  /**
   * Returns tool calls whose accumulated argument buffer is currently valid JSON.
   * Does NOT remove them from the accumulator — call `reset()` when done.
   *
   * Useful for emitting tool calls mid-stream when multiple parallel calls are in flight
   * and some complete before others.
   */
  public getCompletedCalls(): NativeToolCall[] {
    const result: NativeToolCall[] = [];
    for (const pending of this.calls.values()) {
      if (!pending.name) {
        continue;
      }
      try {
        const parsed = JSON.parse(pending.argumentsBuffer);
        if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const call: NativeToolCall = { name: pending.name, arguments: parsed as Record<string, unknown> };
          if (pending.id !== undefined) call.id = pending.id;
          result.push(call);
        }
      } catch {
        // Arguments not yet complete.
      }
    }
    return result;
  }

  /**
   * Force-completes all pending calls, attempting JSON repair on any incomplete argument
   * buffers via `parseJson`. Returns all calls that have a name, even if their arguments
   * could not be parsed (in which case `arguments` will be `{}`).
   *
   * Call this when the stream ends to capture any calls whose arguments never formed
   * complete JSON during streaming.
   */
  public flush(): NativeToolCall[] {
    const result: NativeToolCall[] = [];
    for (const pending of this.calls.values()) {
      if (!pending.name) {
        continue;
      }

      // Try direct JSON.parse first (fast path for complete buffers).
      try {
        const parsed = JSON.parse(pending.argumentsBuffer);
        if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const call: NativeToolCall = { name: pending.name, arguments: parsed as Record<string, unknown> };
          if (pending.id !== undefined) call.id = pending.id;
          result.push(call);
          continue;
        }
      } catch {
        // Fall through to repair.
      }

      // Attempt repair via parseJson for truncated/incomplete argument JSON.
      const repaired = parseJson(pending.argumentsBuffer, { repairIncomplete: true });
      const flushedCall: NativeToolCall = {
        name: pending.name,
        arguments:
          repaired !== null && typeof repaired === 'object' && !Array.isArray(repaired)
            ? (repaired as Record<string, unknown>)
            : {},
      };
      if (pending.id !== undefined) flushedCall.id = pending.id;
      result.push(flushedCall);
    }
    return result;
  }

  /** Clears all accumulated state. */
  public reset(): void {
    this.calls.clear();
  }
}
