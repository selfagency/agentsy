import type { LocalProviderDiscoveryResult, LocalProviderProbeResult } from './types.js';

export interface LocalRoutingDecision {
  fallbackChain: string[];
  providerId: string;
  rationale: string;
  score: number;
}

export interface RouteLocalProvidersOptions {
  preferLocal?: boolean;
  providerPriority?: string[];
}

export function routeLocalProviders(
  discovery: LocalProviderDiscoveryResult,
  options: RouteLocalProvidersOptions = {}
): LocalRoutingDecision[] {
  const providerPriority = options.providerPriority ?? ['jan', 'ollama', 'vllm'];
  const available = new Map<string, LocalProviderProbeResult>([
    ['ollama', discovery.ollama],
    ['vllm', discovery.vllm]
  ]);

  const decisions = discovery.discovered.map(({ provider, models }) => {
    const probe = available.get(provider);
    let latencyScore = 0.5;
    if (probe?.latencyMs !== undefined) {
      latencyScore = Math.max(0, 1 - probe.latencyMs / 10_000);
    }
    const modelCountScore = Math.min(1, models.length / 10);
    const localScore = (options.preferLocal ? 0.3 : 0) + latencyScore * 0.45 + modelCountScore * 0.25;

    return {
      fallbackChain: buildFallbackChain(provider, providerPriority),
      providerId: provider,
      rationale: buildRationale(provider, probe, models.length, options.preferLocal ?? false),
      score: Number(localScore.toFixed(3))
    } satisfies LocalRoutingDecision;
  });

  return decisions.sort((a, b) => b.score - a.score);
}

function buildFallbackChain(providerId: string, providerPriority: string[]): string[] {
  const remaining = providerPriority.filter(entry => entry !== providerId);
  return [providerId, ...remaining];
}

function buildRationale(
  providerId: string,
  probe: LocalProviderProbeResult | undefined,
  modelCount: number,
  preferLocal: boolean
): string {
  return [
    preferLocal ? 'local-first' : 'hybrid',
    ...(probe?.latencyMs === undefined ? [] : [`latency=${probe.latencyMs}ms`]),
    `models=${modelCount}`,
    providerId
  ].join(', ');
}
