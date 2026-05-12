/**
 * AG-UI Protocol Integration
 *
 * Exports event types and adapter functions for integrating with the AG-UI protocol.
 * This module allows llm-stream-parser to emit AG-UI-compatible events for any frontend.
 */

export { toAgUiStream } from './adapter.js';
export type { AdapterOptions } from './adapter.js';
export { convertEventStream, createEventConverter, toCopilotKitEvent, toCustomUIEvent } from './event-converters.js';
export type { CopilotKitEvent, CustomUIEvent } from './event-converters.js';
export { InterruptController, InterruptReason, TimeoutInterrupt, createInterruptEvent } from './interrupt-handler.js';
export { toObservable } from './observable.js';
export type { Observable, Observer, Subscription } from './observable.js';
export { mapReasoningToEvents } from './reasoning-mapper.js';
export type { ReasoningMapperOptions } from './reasoning-mapper.js';
export {
  StateManager,
  applyJsonPatches,
  computeStateDelta,
  createStateDeltaEvent,
  createStateSnapshotEvent,
} from './state-manager.js';
export type { JsonPatchOp } from './state-manager.js';
export * from './types.js';
