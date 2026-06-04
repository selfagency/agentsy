import type { ProviderHealthEntry } from '../health/provider-health-registry.js';
import type { QuotaUsageSnapshot } from '../quota/tracker.js';
import type { ProviderEntry } from '../types.js';

/**
 * Information available to a routing strategy when picking the next provider.
 * Strategies that don't care about health/quota can ignore most fields.
 */
export interface SelectionContext {
  /**
   * Per-provider health snapshot, indexed by providerId.
   * Missing entries are treated as "healthy with no telemetry".
   */
  health: ReadonlyMap<string, ProviderHealthEntry>;
  /**
   * Concurrency counters per provider, indexed by providerId. Optional —
   * least-connections reads this; others ignore it.
   */
  inFlight?: ReadonlyMap<string, number>;
  /**
   * Per-provider quota snapshot, indexed by providerId.
   * Missing entries are treated as "unconstrained".
   */
  quota: ReadonlyMap<string, QuotaUsageSnapshot>;
  /**
   * Request the gateway is about to send. Used for capability-based filtering
   * (e.g. vision / function-calling support) and cost estimation.
   */
  request: {
    estimatedInputTokens?: number;
    model?: string;
    requires?: ReadonlyArray<'tools' | 'vision' | 'streaming' | 'json'>;
  };
}

/**
 * A routing strategy picks the next provider for a request. Returning
 * `undefined` means "no provider is selectable under current constraints";
 * the caller is expected to either fail over or surface
 * `AllProvidersExhaustedError`.
 */
export interface RoutingStrategy {
  readonly name: string;
  select(providers: readonly ProviderEntry[], context: SelectionContext): ProviderEntry | undefined;
}

/**
 * Filter providers by their declared capabilities. Strategies that do not
 * care about capabilities (e.g. round-robin) can ignore this; adaptive uses
 * it to drop providers that don't fit the request.
 *
 * When `request.requires` is non-empty, providers without declared
 * capabilities are rejected — silent acceptance would mask unknown providers
 * as a feature-complete default.
 */
export function matchesRequest(entry: ProviderEntry, request: SelectionContext['request']): boolean {
  const requires = request.requires ?? [];
  if (requires.length === 0) {
    return true;
  }
  const caps = entry.capabilities;
  if (caps === undefined) {
    return false;
  }
  for (const requirement of requires) {
    switch (requirement) {
      case 'tools':
        if (caps.supportsTools !== true) {
          return false;
        }
        break;
      case 'vision':
        if (caps.supportsImages !== true) {
          return false;
        }
        break;
      case 'streaming':
        if (caps.supportsStreaming !== true) {
          return false;
        }
        break;
      case 'json':
        if (caps.supportsJsonMode !== true) {
          return false;
        }
        break;
      default:
        assertNever(requirement);
    }
  }
  return true;
}

function assertNever(value: never): never {
  throw new Error(`Unknown requirement: ${String(value)}`);
}
