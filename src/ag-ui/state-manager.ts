/**
 * AG-UI State Management
 *
 * Utilities for creating state snapshots and RFC 6902 JSON patch deltas.
 * Enables STATE_SNAPSHOT and STATE_DELTA events for incremental state updates.
 */

import type { JsonPatchOperation, StateDeltaEvent, StateSnapshotEvent } from './types.js';
import { EventType } from './types.js';

/**
 * Represents a JSON Patch operation per RFC 6902.
 */
export type JsonPatchOp = JsonPatchOperation;

/**
 * Detects circular references in an object.
 * @internal
 */
function hasCircularReference(obj: any, visited = new WeakSet()): boolean {
  if (obj === null || typeof obj !== 'object') {
    return false;
  }

  if (visited.has(obj)) {
    return true; // Circular reference detected
  }

  visited.add(obj);

  for (const value of Object.values(obj)) {
    if (hasCircularReference(value, visited)) {
      return true;
    }
  }

  visited.delete(obj);
  return false;
}

/**
 * Creates a state snapshot event.
 *
 * @param state - Application state object
 * @param runId - Run ID
 * @param threadId - Optional thread ID
 * @returns State snapshot event
 * @throws Error if state contains circular references
 */
export function createStateSnapshotEvent(
  state: Record<string, any>,
  runId: string,
  threadId?: string,
): StateSnapshotEvent {
  if (hasCircularReference(state)) {
    throw new Error('State object contains circular references and cannot be serialized');
  }

  const eventBase = {
    type: EventType.STATE_SNAPSHOT as const,
    runId,
    timestamp: new Date().toISOString(),
    state,
  };

  return {
    ...eventBase,
    ...(threadId !== undefined && { threadId }),
  } as StateSnapshotEvent;
}

/**
 * Computes a JSON Patch (RFC 6902) delta between two states.
 * Returns the minimal set of operations to transform `from` to `to`.
 *
 * @param from - Previous state
 * @param to - New state
 * @param basePathPrefix - Optional path prefix for nested operations
 * @returns Array of JSON Patch operations
 * @throws Error if either state contains circular references
 */
export function computeStateDelta(
  from: Record<string, any>,
  to: Record<string, any>,
  basePathPrefix = '',
): JsonPatchOp[] {
  if (hasCircularReference(from)) {
    throw new Error('Previous state contains circular references and cannot be processed');
  }
  if (hasCircularReference(to)) {
    throw new Error('New state contains circular references and cannot be processed');
  }

  const patches: JsonPatchOp[] = [];

  // Handle removed and modified properties
  for (const key of Object.keys(from)) {
    const path = basePathPrefix ? `${basePathPrefix}/${key}` : `/${key}`;
    if (!(key in to)) {
      patches.push({ op: 'remove', path });
    } else if (JSON.stringify(from[key]) !== JSON.stringify(to[key])) {
      const fromVal = from[key];
      const toVal = to[key];

      // Recurse for nested objects
      if (
        typeof fromVal === 'object' &&
        fromVal !== null &&
        !Array.isArray(fromVal) &&
        typeof toVal === 'object' &&
        toVal !== null &&
        !Array.isArray(toVal)
      ) {
        patches.push(...computeStateDelta(fromVal, toVal, path));
      } else {
        patches.push({ op: 'replace', path, value: toVal });
      }
    }
  }

  // Handle added properties
  for (const key of Object.keys(to)) {
    if (!(key in from)) {
      const path = basePathPrefix ? `${basePathPrefix}/${key}` : `/${key}`;
      patches.push({ op: 'add', path, value: to[key] });
    }
  }

  return patches;
}

/**
 * Creates a STATE_DELTA event from computed patches.
 *
 * @param patches - JSON Patch operations
 * @param runId - Run ID
 * @param threadId - Optional thread ID
 * @returns State delta event
 */
export function createStateDeltaEvent(patches: JsonPatchOp[], runId: string, threadId?: string): StateDeltaEvent {
  const deltaBase = {
    type: EventType.STATE_DELTA as const,
    runId,
    timestamp: new Date().toISOString(),
    ops: patches,
  };

  return {
    ...deltaBase,
    ...(threadId !== undefined && { threadId }),
  } as StateDeltaEvent;
}

/**
 * Applies JSON Patch operations to a state object.
 * Mutates the state in place.
 *
 * @param state - State object to patch
 * @param patches - JSON Patch operations to apply
 * @throws Error if patch operations are invalid
 */
export function applyJsonPatches(state: Record<string, any>, patches: JsonPatchOp[]): void {
  for (const patch of patches) {
    const parts = patch.path.split('/').filter(p => p);

    switch (patch.op) {
      case 'add':
        {
          if (parts.length === 0) {
            throw new Error('Cannot add to root');
          }
          const key = parts.pop()!;
          let target = state;
          for (const part of parts) {
            if (!(part in target)) {
              target[part] = {};
            }
            target = target[part];
          }
          target[key] = patch.value;
        }
        break;

      case 'remove':
        {
          if (parts.length === 0) {
            throw new Error('Cannot remove root');
          }
          const key = parts.pop()!;
          let target = state;
          for (const part of parts) {
            target = target[part];
          }
          delete target[key];
        }
        break;

      case 'replace':
        {
          if (parts.length === 0) {
            throw new Error('Cannot replace root');
          }
          const key = parts.pop()!;
          let target = state;
          for (const part of parts) {
            target = target[part];
          }
          target[key] = patch.value;
        }
        break;

      default:
        throw new Error(`Unsupported patch operation: ${patch.op}`);
    }
  }
}

/**
 * State manager for tracking and emitting state changes as AG-UI events.
 */
export class StateManager {
  private currentState: Record<string, any>;
  private snapshotCounter: number = 0;

  constructor(initialState: Record<string, any> = {}) {
    if (hasCircularReference(initialState)) {
      throw new Error('Initial state contains circular references and cannot be processed');
    }
    this.currentState = JSON.parse(JSON.stringify(initialState));
  }

  /**
   * Gets the current state.
   */
  getCurrentState(): Record<string, any> {
    return JSON.parse(JSON.stringify(this.currentState));
  }

  /**
   * Creates a snapshot event for current state.
   */
  createSnapshotEvent(runId: string, threadId?: string): StateSnapshotEvent {
    return createStateSnapshotEvent(this.getCurrentState(), runId, threadId);
  }

  /**
   * Updates state and returns delta event.
   *
   * @param newState - New state values to merge/replace
   * @param runId - Run ID for the event
   * @param threadId - Optional thread ID
   * @returns Computed delta event (if changes exist), undefined otherwise
   * @throws Error if new state contains circular references
   */
  updateState(newState: Record<string, any>, runId: string, threadId?: string): StateDeltaEvent | undefined {
    if (hasCircularReference(newState)) {
      throw new Error('New state contains circular references and cannot be processed');
    }
    const patches = computeStateDelta(this.currentState, newState);
    if (patches.length === 0) {
      return undefined; // No changes
    }
    this.currentState = newState;
    this.snapshotCounter++;
    return createStateDeltaEvent(patches, runId, threadId);
  }

  /**
   * Resets to initial state.
   * @throws Error if initial state contains circular references
   */
  reset(initialState: Record<string, any> = {}): void {
    if (hasCircularReference(initialState)) {
      throw new Error('Initial state contains circular references and cannot be processed');
    }
    this.currentState = JSON.parse(JSON.stringify(initialState));
    this.snapshotCounter = 0;
  }
}
