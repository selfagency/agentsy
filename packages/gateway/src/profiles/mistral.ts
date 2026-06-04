import { genericErrorClassifier } from './generic-error-classifier.js';
import type { ProviderProfile } from './types.js';

export const mistralProfiles: ProviderProfile[] = [
  {
    baseUrl: 'https://api.mistral.ai/v1',
    errorClassifier: genericErrorClassifier,
    headers: {},
    id: 'mistral-large',
    name: 'Mistral Large',
    provider: 'openai',
    model: 'mistral-large-latest',
    usageProbes: []
  },
  {
    baseUrl: 'https://api.mistral.ai/v1',
    errorClassifier: genericErrorClassifier,
    headers: {},
    id: 'mistral-medium',
    name: 'Mistral Medium',
    provider: 'openai',
    model: 'mistral-medium-latest',
    usageProbes: []
  }
];
