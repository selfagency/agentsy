import { parseJson, type ParseJsonOptions } from './parseJson.js';
import { type StreamingPartial } from './types.js';

export interface StreamJsonOptions extends ParseJsonOptions {
  /**
   * When true, emits partial objects by attempting to repair incomplete JSON
   * at each chunk boundary. Defaults to true.
   */
  emitPartials?: boolean;
  /**
   * When true, computes newly-populated or changed fields on each emission and
   * includes them in `newFields`. Defaults to false.
   */
  emitFields?: boolean;
  /**
   * When true, stops emitting after the root JSON object/array closes,
   * ignoring any trailing LLM prose. Defaults to false.
   * Inspired by llm-json-stream-typescript "yap filter".
   */
  stopAfterRoot?: boolean;
}

/**
 * A single field (or array item) that was newly populated or updated in a streaming
 * JSON parse result.
 */
export interface StreamJsonField {
  /**
   * Dot-notation path to the field, e.g. `"name"`, `"address.city"`, or `"items[0]"`.
   * Top-level scalar values use `""` (empty string).
   */
  path: string;
  /** The current value at this path. */
  value: unknown;
  /**
   * Whether the value at this path is considered complete (no more streaming
   * changes expected at this exact path). A string field that is still arriving
   * chunk by chunk will have `isComplete: false` until the surrounding object is
   * confirmed complete.
   */
  isComplete: boolean;
}

export interface StreamJsonResult<T = unknown> {
  /** The latest parsed value. May be partial if `emitPartials` is enabled. */
  value: T;
  /** Whether the value was obtained from repaired (incomplete) JSON. */
  isPartial: boolean;
  /** `'partial'` while JSON is still being received; `'completed'` on the final complete parse. */
  status: 'partial' | 'completed';
  /**
   * Fields that were newly added or whose value changed since the previous emission.
   * Always present; empty when `emitFields: false` (the default) or when no fields
   * changed since the previous emission.
   */
  newFields: StreamJsonField[];
}

// ---------------------------------------------------------------------------
// Internal field diffing helpers
// ---------------------------------------------------------------------------

/**
 * Collect all leaf (and array-item) paths from a value and return them as
 * `{ path, value }` pairs suitable for diffing across successive parses.
 */
function collectPaths(value: unknown, prefix: string, out: Map<string, unknown>): void {
  if (value === null || typeof value !== 'object') {
    out.set(prefix, value);
    return;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      out.set(prefix, value);
      return;
    }
    for (let i = 0; i < value.length; i++) {
      collectPaths(value[i], prefix === '' ? `[${i}]` : `${prefix}[${i}]`, out);
    }
    return;
  }

  const keys = Object.keys(value as Record<string, unknown>);
  if (keys.length === 0) {
    out.set(prefix, value);
    return;
  }
  for (const key of keys) {
    const child = (value as Record<string, unknown>)[key];
    collectPaths(child, prefix === '' ? key : `${prefix}.${key}`, out);
  }
}

/**
 * Diff two snapshots represented as path→value maps and return the set of
 * paths that are new or have a changed serialised value.
 */
function diffPaths(prev: Map<string, unknown>, next: Map<string, unknown>): string[] {
  const changed: string[] = [];
  for (const [path, val] of next) {
    if (!prev.has(path) || JSON.stringify(prev.get(path)) !== JSON.stringify(val)) {
      changed.push(path);
    }
  }
  return changed;
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
): AsyncGenerator<StreamJsonResult<StreamingPartial<T>>> {
  const emitPartials = options.emitPartials ?? true;
  const trackFields = options.emitFields === true;
  const stopAfterRoot = options.stopAfterRoot ?? false;
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
  let prevPaths: Map<string, unknown> = new Map();
  let rootComplete = false;

  function tryParse(text: string, repair: boolean): unknown {
    return parseJson(text, repair ? { ...parseOpts, repairIncomplete: true } : parseOpts);
  }

  function computeNewFields(parsed: unknown, isComplete: boolean): StreamJsonField[] {
    if (!trackFields) return [];
    const next = new Map<string, unknown>();
    collectPaths(parsed, '', next);
    const changedPaths = diffPaths(prevPaths, next);
    prevPaths = next;
    return changedPaths.map(path => ({
      path,
      value: next.get(path),
      isComplete,
    }));
  }

  for await (const chunk of source) {
    // If yap filter is enabled and we've already completed, stop
    if (stopAfterRoot && rootComplete) {
      break;
    }

    accumulated += chunk;

    // Try complete parse first
    const complete = tryParse(accumulated, false);
    if (complete !== null) {
      const serialized = JSON.stringify(complete);
      // Always emit when transitioning partial→complete, even if value is same
      if (serialized !== lastSerialized || lastWasPartial) {
        const newFields = computeNewFields(complete, true);
        lastSerialized = serialized;
        lastWasPartial = false;
        rootComplete = true;
        yield { value: complete as StreamingPartial<T>, isPartial: false, status: 'completed', newFields };
      }
      if (stopAfterRoot) {
        break;
      }
      continue;
    }

    if (!emitPartials) continue;

    const partial = tryParse(accumulated, true);
    if (partial === null) continue;

    const serialized = JSON.stringify(partial);
    if (serialized === lastSerialized) continue;

    const newFields = computeNewFields(partial, false);
    lastSerialized = serialized;
    lastWasPartial = true;
    yield { value: partial as StreamingPartial<T>, isPartial: true, status: 'partial', newFields };
  }
}
