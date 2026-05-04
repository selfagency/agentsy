import type { OutputPart } from '@agentsy/core/processor';
import { parseJson } from '@agentsy/core/structured';

export interface VSCodeToolCallPartLike {
  callId: string;
  name: string;
  input: Record<string, unknown>;
}

interface PendingDeltaCall {
  id?: string;
  name?: string;
  argumentsBuffer: string;
}

/**
 * Converts a processor `tool_call` output part into a VS Code-like tool-call payload.
 */
export function toVSCodeToolCallPart(
  part: Extract<OutputPart, { type: 'tool_call' }>,
  options?: { fallbackCallId?: string | (() => string) },
): VSCodeToolCallPartLike {
  const fallbackCallId =
    typeof options?.fallbackCallId === 'function'
      ? options.fallbackCallId()
      : (options?.fallbackCallId ?? `${part.call.name}_call`);

  return {
    callId: part.call.id ?? fallbackCallId,
    name: part.call.name,
    input: part.call.parameters,
  };
}

/**
 * Stateful accumulator for streaming `tool_call_delta` parts.
 */
export class ToolCallDeltaAccumulator {
  private readonly calls = new Map<number, PendingDeltaCall>();

  add(delta: Extract<OutputPart, { type: 'tool_call_delta' }>): void {
    const existing = this.calls.get(delta.index);
    if (existing !== undefined) {
      if (delta.id !== undefined) existing.id = delta.id;
      existing.name = delta.name;
      existing.argumentsBuffer += delta.argumentsDelta;
      return;
    }

    this.calls.set(delta.index, {
      ...(delta.id === undefined ? {} : { id: delta.id }),
      name: delta.name,
      argumentsBuffer: delta.argumentsDelta,
    });
  }

  finalize(options?: {
    repairIncomplete?: boolean;
    onWarning?: (message: string, context?: Record<string, unknown>) => void;
  }): VSCodeToolCallPartLike[] {
    const repairIncomplete = options?.repairIncomplete ?? true;
    const parts: VSCodeToolCallPartLike[] = [];

    for (const [index, call] of this.calls.entries()) {
      const fallbackId = call.id ?? `native_${index}`;
      const fallbackName = call.name ?? 'tool_call';

      let parsed: Record<string, unknown> = {};
      if (call.argumentsBuffer.length > 0) {
        try {
          const json = JSON.parse(call.argumentsBuffer);
          if (json !== null && typeof json === 'object' && !Array.isArray(json)) {
            parsed = json as Record<string, unknown>;
          }
        } catch {
          if (repairIncomplete) {
            const repaired = parseJson(call.argumentsBuffer, { repairIncomplete: true });
            if (repaired !== null && typeof repaired === 'object' && !Array.isArray(repaired)) {
              parsed = repaired as Record<string, unknown>;
            } else {
              options?.onWarning?.('Unable to repair malformed tool_call_delta arguments; using empty input.', {
                index,
              });
            }
          } else {
            options?.onWarning?.('Malformed tool_call_delta arguments; using empty input.', { index });
          }
        }
      }

      parts.push({
        callId: fallbackId,
        name: fallbackName,
        input: parsed,
      });
    }

    this.calls.clear();
    return parts;
  }

  reset(): void {
    this.calls.clear();
  }
}

/** Convenience function wrapper around ToolCallDeltaAccumulator#add. */
export function accumulateToolCallDeltas(
  accumulator: ToolCallDeltaAccumulator,
  delta: Extract<OutputPart, { type: 'tool_call_delta' }>,
): void {
  accumulator.add(delta);
}
