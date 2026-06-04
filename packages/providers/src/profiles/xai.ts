import { genericErrorClassifier } from './error-classifier.js';
import type { ProviderProfile } from './types.js';

export const xaiProfiles: ProviderProfile[] = [
  {
    baseUrl: 'https://api.x.ai/v1',
    errorClassifier: genericErrorClassifier,
    headers: {},
    id: 'xai-grok-2',
    name: 'xAI Grok 2',
    provider: 'openai',
    model: 'grok-2-latest',
    usageProbes: []
  },
  {
    baseUrl: 'https://api.x.ai/v1',
    errorClassifier: genericErrorClassifier,
    headers: {},
    id: 'xai-grok-2-mini',
    name: 'xAI Grok 2 Mini',
    provider: 'openai',
    model: 'grok-2-mini',
    usageProbes: []
  }
];
