/**
 * AG-UI Protocol Integration
 *
 * Exports event types and adapter functions for integrating with the AG-UI protocol.
 * This module allows llm-stream-parser to emit AG-UI-compatible events for any frontend.
 */

import type {
  AgUiEvent,
  ReasoningEndEvent,
  ReasoningMessageContentEvent,
  ReasoningMessageEndEvent,
  ReasoningMessageStartEvent,
  ReasoningStartEvent,
  RunErrorEvent,
  RunFinishedEvent,
  RunStartedEvent,
  TextMessageContentEvent,
  ToolCallArgsEvent,
  ToolCallEndEvent,
  ToolCallStartEvent,
} from '@agentsy/types';
import { EventType } from '@agentsy/types';

export { toAgUiStream } from './adapter.js';
export type { AdapterOptions } from './adapter.js';
export { convertEventStream, createEventConverter, toCopilotKitEvent, toCustomUIEvent } from './event-converters.js';
export type { CopilotKitEvent, CustomUIEvent } from './event-converters.js';
export { createInterruptEvent, InterruptController, InterruptReason, TimeoutInterrupt } from './interrupt-handler.js';
export { toObservable } from './observable.js';
export type { Observable, Observer, Subscription } from './observable.js';
export { mapReasoningToEvents } from './reasoning-mapper.js';
export type { ReasoningMapperOptions } from './reasoning-mapper.js';
export {
  applyJsonPatches,
  computeStateDelta,
  createStateDeltaEvent,
  createStateSnapshotEvent,
  StateManager,
} from './state-manager.js';
export type { JsonPatchOp } from './state-manager.js';

export { EventType };
export type {
  AgUiEvent,
  ReasoningEndEvent,
  ReasoningMessageContentEvent,
  ReasoningMessageEndEvent,
  ReasoningMessageStartEvent,
  ReasoningStartEvent,
  RunErrorEvent,
  RunFinishedEvent,
  RunStartedEvent,
  TextMessageContentEvent,
  ToolCallArgsEvent,
  ToolCallEndEvent,
  ToolCallStartEvent,
};
