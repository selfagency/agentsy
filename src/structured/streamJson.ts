import { parseJson, type ParseJsonOptions } from './parseJson.js';

export interface StreamJsonOptions extends ParseJsonOptions {
  /**
   * When true, emits partial objects by attempting to repair incomplete JSON
   * at each chunk boundary. Defaults to true.
   */
  emitPartials?: boolean;
}

export interface StreamJsonResult<T = unknown> {
  /** The latest parsed value. May be partial if `emitPartials` is enabled. */
  value: T;
  /** Whether the value was obtained from repaired (incomplete) JSON. */
  isPartial: boolean;
}

/**
 * Incrementally parses JSON from a text stream, yielding partial and complete
 * objects as chunks arrive. Inspired by Vercel AI SDK's `Output.object` pattern.
 *
 * Yields a `StreamJsonResult` each time a new parseable snapshot is available.
 * Only yields when the parsed value actually changes (deep equality by serialisation).
 */
export async function* streamJson<T = unknown>(
  source: AsyncIterable<string>,
  options: StreamJsonOptions = {},
): AsyncGenerator<StreamJsonResult<T>> {
  const emitPartials = options.emitPartials ?? true;
  const parseOpts: ParseJsonOptions = {};
  if (options.selectMostComprehensive !== undefined) {
    parseOpts.selectMostComprehensive = options.selectMostComprehensive;
  }
  if (options.maxJsonDepth !== undefined) {
    parseOpts.maxJsonDepth = options.maxJsonDepth;
  }
  if (options.maxJsonKeys !== undefined) {
    parseOpts.maxJsonKeys = options.maxJsonKeys;
  }

  let accumulated = '';
  let lastSerialized: string | undefined;
  let lastWasPartial = false;

  function tryParse(text: string, repair: boolean): unknown {
    return parseJson(text, repair ? { ...parseOpts, repairIncomplete: true } : parseOpts);
  }

  for await (const chunk of source) {
    accumulated += chunk;

    // Try complete parse first
    const complete = tryParse(accumulated, false);
    if (complete !== null) {
      const serialized = JSON.stringify(complete);
      // Always emit when transitioning partial→complete, even if value is same
      if (serialized !== lastSerialized || lastWasPartial) {
        lastSerialized = serialized;
        lastWasPartial = false;
        yield { value: complete as T, isPartial: false };
      }
      continue;
    }

    // Try partial parse with repair if enabled
    if (emitPartials) {
      const partial = tryParse(accumulated, true);
      if (partial !== null) {
        const serialized = JSON.stringify(partial);
        if (serialized !== lastSerialized) {
          lastSerialized = serialized;
          lastWasPartial = true;
          yield { value: partial as T, isPartial: true };
        }
      }
    }
  }
}
