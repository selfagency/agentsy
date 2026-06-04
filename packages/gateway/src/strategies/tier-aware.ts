import type { ProviderEntry } from '../types.js';
import type { RoutingStrategy, SelectionContext } from './strategy.js';

/**
 * Provider capability tier. Drives tier-aware routing.
 *
 * - `micro` — local / on-device inference (apfel, ollama, lm-studio,
 *   localai, vllm). Prefer for trivial lookups, classification,
 *   and other tasks where a frontier model is overkill.
 * - `small` — budget cloud (T4 / L4 GPUs, low-cost providers).
 * - `mid` — standard cloud (A10G / A100, mainstream providers).
 * - `frontier` — best available (H100 / B200, premium providers).
 */
export type ProviderTier = 'micro' | 'small' | 'mid' | 'frontier';

/**
 * Per-tier preferred provider ordering. The gateway uses this as
 * the primary candidate list; if no provider in the preferred list
 * is eligible, it walks to the next tier.
 */
export interface TierAwareOptions {
  /**
   * Wraps the default strategy used when no providers are eligible
   * at the requested tier, or when the tier is unknown.
   */
  defaultStrategy: RoutingStrategy;
  /**
   * Whether to escalate when the requested tier reports a 429
   * (rate-limit / quota exhausted). Default: true.
   */
  escalateOnOverload?: boolean;
  /**
   * Escalation chain. When the requested tier is exhausted, the
   * gateway walks this list in order. Default:
   *   micro → small → mid → frontier
   */
  escalationChain?: readonly ProviderTier[];
  /**
   * Maximum number of tiers to walk before giving up. Default: 4
   * (i.e. the full chain).
   */
  maxEscalationSteps?: number;
  /**
   * Tier index for each provider. The gateway reads this from
   * `ProviderEntry.tier` (set by `registerLocalProviders()` for
   * local backends). Providers without a tier are not eligible for
   * tier-aware selection unless the tier is unset, in which case
   * they're treated as `mid`.
   */
  tierOf: (entry: ProviderEntry) => ProviderTier | undefined;
}

const DEFAULT_ESCALATION_CHAIN: readonly ProviderTier[] = ['micro', 'small', 'mid', 'frontier'];

/**
 * Tier-aware strategy. Picks a provider in the requested tier
 * (micro / small / mid / frontier) using the configured
 * `tierOf()` mapping. If no eligible provider exists at that
 * tier, escalates through `escalationChain` until it finds one
 * or runs out of steps. Falls back to `defaultStrategy` when the
 * tier is unknown or the chain is exhausted.
 *
 * The strategy composes with the existing pre-filter
 * (`passesConstraints`-style logic in other strategies) by
 * delegating to a base strategy for ordering within each tier.
 */
export class TierAwareStrategy implements RoutingStrategy {
  readonly name = 'tier-aware';
  readonly #defaultStrategy: RoutingStrategy;
  readonly #escalationChain: readonly ProviderTier[];
  readonly #escalateOnOverload: boolean;
  readonly #maxEscalationSteps: number;
  readonly #tierOf: (entry: ProviderEntry) => ProviderTier | undefined;

  constructor(options: TierAwareOptions) {
    this.#defaultStrategy = options.defaultStrategy;
    this.#escalationChain = options.escalationChain ?? DEFAULT_ESCALATION_CHAIN;
    this.#escalateOnOverload = options.escalateOnOverload ?? true;
    this.#maxEscalationSteps = options.maxEscalationSteps ?? this.#escalationChain.length;
    this.#tierOf = options.tierOf;
  }

  select(providers: readonly ProviderEntry[], context: SelectionContext): ProviderEntry | undefined {
    const requestedTier = context.request.taskTier;
    if (requestedTier === undefined) {
      return this.#defaultStrategy.select(providers, context);
    }

    const chain = this.#buildChain(requestedTier);
    for (let step = 0; step < chain.length && step < this.#maxEscalationSteps; step++) {
      const tier = chain[step];
      if (tier === undefined) {
        continue;
      }
      const candidates = providers.filter(entry => this.#tierOf(entry) === tier);
      if (candidates.length === 0) {
        continue;
      }
      const picked = this.#defaultStrategy.select(candidates, context);
      if (picked !== undefined) {
        return picked;
      }
    }
    return this.#defaultStrategy.select(providers, context);
  }

  #buildChain(start: ProviderTier): readonly ProviderTier[] {
    const startIndex = this.#escalationChain.indexOf(start);
    if (startIndex < 0) {
      return this.#escalationChain;
    }
    return this.#escalationChain.slice(startIndex);
  }
}

/**
 * Helper to build a tier-of lookup from a list of provider ids.
 * Useful when tiers are configured in the gateway config rather
 * than on each `ProviderEntry`.
 */
export function buildTierOf(
  tiers: Readonly<Record<string, ProviderTier>>
): (entry: ProviderEntry) => ProviderTier | undefined {
  const map = new Map<string, ProviderTier>(Object.entries(tiers));
  return (entry: ProviderEntry) => map.get(entry.id);
}

/**
 * Default provider-id → tier mapping for built-in providers.
 * Used as a fallback when `registerLocalProviders()` is not called
 * and the gateway is given a list of cloud provider ids.
 */
export const DEFAULT_PROVIDER_TIERS: Readonly<Record<string, ProviderTier>> = {
  // micro — local / on-device backends
  apfel: 'micro',
  'apfel-local': 'micro',
  'lm-studio': 'micro',
  'local-ai': 'micro',
  ollama: 'micro',
  vllm: 'micro',
  // small — budget cloud
  deepinfra: 'small',
  'gemini-flash': 'small',
  groq: 'small',
  // mid — standard cloud
  'claude-sonnet-4-5': 'mid',
  deepseek: 'mid',
  'gpt-4o-mini': 'mid',
  'gpt-4.1': 'mid',
  mistral: 'mid',
  openai: 'mid',
  perplexity: 'mid',
  zai: 'mid',
  // frontier — premium
  anthropic: 'frontier',
  bedrock: 'frontier',
  'claude-opus-4': 'frontier',
  'gemini-2.5-pro': 'frontier',
  'gpt-5': 'frontier',
  xai: 'frontier'
};

export const ESCALATION_CHAIN: readonly ProviderTier[] = DEFAULT_ESCALATION_CHAIN;
