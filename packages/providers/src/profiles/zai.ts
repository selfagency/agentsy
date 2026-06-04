import { genericErrorClassifier } from './error-classifier.js';
import type { ProviderProfile } from './types.js';

/**
 * Zai is a zero-API (in-process) provider for tests and offline development.
 * It never makes real network calls.
 */
export const zaiProfiles: ProviderProfile[] = [
  {
    errorClassifier: genericErrorClassifier,
    headers: {},
    id: 'zai-mock',
    name: 'Zai Mock Provider',
    provider: 'openai',
    model: 'zai-mock',
    usageProbes: []
  }
];
