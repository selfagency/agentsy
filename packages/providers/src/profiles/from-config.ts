import { genericErrorClassifier } from './error-classifier.js';
import { genericHeaderParser } from './header-parser.js';
import type { ProviderProfile, ProviderProfileConfig, UsageProbe } from './types.js';

export function fromConfig(config: ProviderProfileConfig): ProviderProfile {
  const probes: UsageProbe[] = config.usageProbes ? [...config.usageProbes] : [];
  if (probes.length === 0 && config.usageProbe !== undefined) {
    // Migrate legacy `usageProbe: string` config into a single api probe.
    const migrated: UsageProbe = { kind: 'api', path: config.usageProbe };
    probes.push(migrated);
  }

  return {
    ...(config.baseUrl !== undefined && { baseUrl: config.baseUrl }),
    ...(config.capabilities !== undefined && { capabilities: config.capabilities }),
    ...(config.errorClassifier !== undefined && { errorClassifier: config.errorClassifier }),
    headers: genericHeaderParser(config.headers ?? {}),
    id: config.id,
    ...(config.model !== undefined && { model: config.model }),
    name: config.name,
    provider: config.provider,
    ...(config.retryPolicy !== undefined && { retryPolicy: config.retryPolicy }),
    usageProbes: probes,
    ...(config.usageProbe !== undefined && { usageProbe: config.usageProbe }),
    errorClassifier: config.errorClassifier ?? genericErrorClassifier
  };
}
