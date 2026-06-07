/**
 * Routing diagnostics event and handler helper for replica selection.
 *
 * Fires a `ReplicaSelectionDiagnosticsEvent` after each gateway
 * model selection decision, carrying the full selection context
 * for observability and debugging.
 */

import type { HookRegistry } from './registry.js';
import type { ModelSelectionDiagnosticsEvent } from './types.js';

/**
 * Emit a routing diagnostics event through the hook registry.
 * Does nothing if no handler is registered for this event type.
 */
export function emitRoutingDiagnostics(
  registry: HookRegistry,
  event: Omit<ModelSelectionDiagnosticsEvent, 'type'> & { sessionId: string }
): void {
  registry.fire({
    type: 'ModelSelectionDiagnostics',
    ...event
  });
}
