import { genericErrorClassifier } from './error-classifier.js';
import type { ProviderProfile } from './types.js';

const rateLimitProbe = {
  authPrefix: 'Bearer',
  kind: 'api' as const,
  path: '/v1/me/rate_limit'
};

export const deepinfraProfiles: ProviderProfile[] = [
  {
    baseUrl: 'https://api.deepinfra.com/v1/openai',
    errorClassifier: genericErrorClassifier,
    headers: {},
    id: 'deepinfra-llama-3.3-70b',
    name: 'DeepInfra Llama 3.3 70B',
    provider: 'openai',
    model: 'meta-llama/Llama-3.3-70B-Instruct',
    usageProbes: [rateLimitProbe]
  },
  {
    baseUrl: 'https://api.deepinfra.com/v1/openai',
    errorClassifier: genericErrorClassifier,
    headers: {},
    id: 'deepinfra-qwen-2.5-72b',
    name: 'DeepInfra Qwen 2.5 72B',
    provider: 'openai',
    model: 'Qwen/Qwen2.5-72B-Instruct',
    usageProbes: [rateLimitProbe]
  }
];
