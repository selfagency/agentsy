import { genericErrorClassifier } from './generic-error-classifier.js';
import { genericHeaderParser } from './generic-header-parser.js';
import type { ProviderProfile, ProviderProfileConfig } from './types.js';

export function fromConfig(config: ProviderProfileConfig): ProviderProfile {
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
    ...(config.usageProbe !== undefined && { usageProbe: config.usageProbe }),
    errorClassifier: config.errorClassifier ?? genericErrorClassifier
  };
}
