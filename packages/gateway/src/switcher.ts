import { ModelAliasMap } from './registry/model-alias.js';
import type { ProviderEntry } from './types.js';

/**
 * Public info about a model that the switcher can target.
 */
export interface ModelInfo {
  /**
   * Alias as known to the user (e.g. `gpt-4o`). Empty string when
   * the model entry is provider-pinned with no alias mapping.
   */
  alias: string;
  /**
   * The provider entry that currently serves this model.
   */
  provider: string;
  /**
   * The provider-specific model identifier passed to upstream APIs
   * (e.g. `claude-opus-4-20250514` for the `claude-opus-4` alias).
   */
  upstreamModel: string;
}

/**
 * Input to `ModelSwitcher.switch()`.
 */
export interface ModelSwitchConfig {
  /**
   * Alias or upstream model identifier. Aliases are looked up in
   * `ModelAliasMap`; if not present, the value is treated as an
   * upstream model id on the currently-bound provider.
   */
  model: string;
  /**
   * Optional provider entry id to switch to. Required when the
   * model alias maps to multiple providers (currently none do) or
   * when the alias itself is unknown and the caller wants to pin a
   * specific provider. If omitted, the switcher picks the first
   * provider that declares a match.
   */
  provider?: string;
  /**
   * Optional session id. Reserved for future per-session model
   * pinning; currently the switcher operates on a shared model
   * pointer so the parameter is accepted but not stored.
   */
  session?: string;
}

export interface ModelSwitcherOptions {
  /**
   * Snapshot of provider entries known to the gateway. The switcher
   * uses this to look up providers and to extract aliases for
   * `getSupportedModels()`. The array is captured by reference; the
   * switcher reads but does not mutate it.
   */
  readonly providers: readonly ProviderEntry[];
  /**
   * Callback the switcher invokes to apply the new model. The
   * gateway client supplies this to publish its `config.model` so
   * subsequent `complete()` / `stream()` calls pick up the change.
   */
  readonly setActiveModel: (upstreamModel: string, provider: ProviderEntry) => void;
}

/**
 * Tracks the currently-active model for a `LoadBalancedClient` and
 * resolves model aliases to provider entries. The switcher itself
 * does not call the upstream provider; the gateway client does. The
 * switcher just owns the pointer and validation.
 */
export class ModelSwitcher {
  readonly #providers: readonly ProviderEntry[];
  readonly #setActiveModel: (upstreamModel: string, provider: ProviderEntry) => void;
  #currentModel: string;
  #currentProvider: string;

  constructor(options: ModelSwitcherOptions) {
    this.#providers = options.providers;
    this.#setActiveModel = options.setActiveModel;
    const first = this.#providers[0];
    this.#currentModel = first?.model ?? '';
    this.#currentProvider = first?.id ?? '';
  }

  /**
   * Switch the active model. Resolves the alias via `ModelAliasMap`,
   * then publishes the resolved `(provider, upstreamModel)` pair
   * through the callback supplied at construction time. Throws if
   * no provider can serve the requested model.
   */
  switch(config: ModelSwitchConfig): { model: string; provider: string } {
    const resolved = this.#resolve(config);
    this.#currentModel = resolved.upstreamModel;
    this.#currentProvider = resolved.provider.id;
    this.#setActiveModel(resolved.upstreamModel, resolved.provider);
    return {
      model: resolved.upstreamModel,
      provider: resolved.provider.id
    };
  }

  /**
   * Snapshot of the currently-active model. Both `model` and
   * `provider` are empty strings if the gateway was constructed
   * with no providers.
   */
  getCurrentConfig(): { model: string; provider: string } {
    return {
      model: this.#currentModel,
      provider: this.#currentProvider
    };
  }

  /**
   * Flat list of models the gateway can currently route to. Each
   * entry pairs the alias (or upstream id) with the provider that
   * serves it. The list is derived from the providers passed at
   * construction time.
   */
  getSupportedModels(): ModelInfo[] {
    const result: ModelInfo[] = [];
    const seen = new Set<string>();
    this.#addDirectModels(result, seen);
    this.#addAliasModels(result, seen);
    return result;
  }

  #addDirectModels(result: ModelInfo[], seen: Set<string>): void {
    for (const provider of this.#providers) {
      if (provider.model !== undefined && provider.model.length > 0) {
        const key = `${provider.id}::${provider.model}`;
        if (!seen.has(key)) {
          seen.add(key);
          result.push({
            alias: '',
            provider: provider.id,
            upstreamModel: provider.model
          });
        }
      }
    }
  }

  #addAliasModels(result: ModelInfo[], seen: Set<string>): void {
    for (const [alias, byProvider] of ModelAliasMap) {
      for (const [providerId, upstream] of Object.entries(byProvider)) {
        const target = this.#providers.find(p => p.provider === providerId);
        if (target === undefined) {
          continue;
        }
        const key = `${target.id}::${upstream}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        result.push({ alias, provider: target.id, upstreamModel: upstream });
      }
    }
  }

  #resolve(config: ModelSwitchConfig): { provider: ProviderEntry; upstreamModel: string } {
    if (config.provider !== undefined) {
      const target = this.#providers.find(p => p.id === config.provider);
      if (target === undefined) {
        throw new Error(`Unknown provider: ${config.provider}`);
      }
      return { provider: target, upstreamModel: config.model };
    }

    const aliasEntry = ModelAliasMap.get(config.model);
    if (aliasEntry !== undefined) {
      for (const [providerId, upstream] of Object.entries(aliasEntry)) {
        const target = this.#providers.find(p => p.provider === providerId);
        if (target !== undefined) {
          return { provider: target, upstreamModel: upstream };
        }
      }
    }

    return this.#resolveDirectMatch(config);
  }

  #resolveDirectMatch(config: ModelSwitchConfig): { provider: ProviderEntry; upstreamModel: string } {
    for (const provider of this.#providers) {
      if (provider.model === config.model) {
        return { provider, upstreamModel: config.model };
      }
    }
    const first = this.#providers[0];
    if (first === undefined) {
      throw new Error('No providers configured');
    }
    return { provider: first, upstreamModel: config.model };
  }
}
