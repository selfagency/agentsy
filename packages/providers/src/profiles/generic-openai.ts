import { genericErrorClassifier } from './error-classifier.js';
import type { ProviderProfile, UsageProbe } from './types.js';

/**
 * Generic OpenAI-compatible profile used as a template for any provider
 * that follows the OpenAI Chat Completions wire format.
 */
export function buildGenericOpenAiProfile(config: {
  baseUrl: string;
  id: string;
  model: string;
  name: string;
  usageProbes?: UsageProbe[];
}): ProviderProfile {
  return {
    baseUrl: config.baseUrl,
    errorClassifier: genericErrorClassifier,
    headers: {},
    id: config.id,
    name: config.name,
    provider: 'openai',
    model: config.model,
    usageProbes: config.usageProbes ?? []
  };
}

export const genericOpenAiProfiles: ProviderProfile[] = [
  buildGenericOpenAiProfile({
    id: 'openai-compatible-v1',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o',
    name: 'OpenAI Compatible v1'
  })
];
