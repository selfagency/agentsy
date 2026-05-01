/**
 * AG-UI Protocol Integration
 *
 * Exports event types and adapter functions for integrating with the AG-UI protocol.
 * This module allows llm-stream-parser to emit AG-UI-compatible events for any frontend.
 */

export * from './types.js';
export type { AdapterOptions } from './adapter.js';
export { toAgUiStream } from './adapter.js';
export type { ReasoningMapperOptions } from './reasoning-mapper.js';
export { mapReasoningToEvents } from './reasoning-mapper.js';
export type { CopilotKitEvent, CustomUIEvent } from './event-converters.js';
export { toCopilotKitEvent, toCustomUIEvent, createEventConverter, convertEventStream } from './event-converters.js';
export type { Observable, Observer, Subscription } from './observable.js';
export { toObservable } from './observable.js';
export type { JsonPatchOp } from './state-manager.js';
export {
  createStateSnapshotEvent,
  computeStateDelta,
  createStateDeltaEvent,
  applyJsonPatches,
  StateManager,
} from './state-manager.js';
export { InterruptReason, InterruptController, createInterruptEvent, TimeoutInterrupt } from './interrupt-handler.js';
