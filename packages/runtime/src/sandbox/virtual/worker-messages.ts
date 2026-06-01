/**
 * Message types exchanged between the virtual sandbox and its worker thread.
 *
 * The worker sends {@link WorkerMessage} payloads back to the main thread
 * via `parentPort.postMessage()`. Each variant carries a discriminated
 * `type` field so the main thread can narrow safely.
 */

/** A worker message carrying console / runtime output. */
export interface WorkerOutputMessage {
  readonly args: unknown[];
  readonly type: 'log' | 'error' | 'warn' | 'info';
}

/** Signals that user code threw at runtime. */
export interface WorkerRuntimeErrorMessage {
  readonly args: unknown[];
  readonly type: 'runtime-error';
}

/** Signals successful execution (no error thrown). */
export interface WorkerResultMessage {
  readonly type: 'result';
  readonly value: unknown;
}

/** Union of all messages the worker may post to the parent. */
export type WorkerMessage = WorkerOutputMessage | WorkerRuntimeErrorMessage | WorkerResultMessage;
