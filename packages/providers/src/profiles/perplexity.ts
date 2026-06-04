import { genericErrorClassifier } from './error-classifier.js';
import type { ProviderProfile } from './types.js';

export const perplexityProfiles: ProviderProfile[] = [
  {
    baseUrl: 'https://api.perplexity.ai',
    errorClassifier: genericErrorClassifier,
    headers: {},
    id: 'perplexity-pplx-online',
    name: 'Perplexity Online',
    provider: 'openai',
    model: 'pplx-online',
    usageProbes: []
  },
  {
    baseUrl: 'https://api.perplexity.ai',
    errorClassifier: genericErrorClassifier,
    headers: {},
    id: 'perplexity-sonar',
    name: 'Perplexity Sonar',
    provider: 'openai',
    model: 'llama-3.1-sonar-small-128k-online',
    usageProbes: []
  }
];
