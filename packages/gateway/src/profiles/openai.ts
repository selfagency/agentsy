import { genericErrorClassifier } from './generic-error-classifier.js';
import type { ProviderProfile } from './types.js';

export const openaiProfiles: ProviderProfile[] = [
  {
    baseUrl: 'https://api.openai.com/v1',
    errorClassifier: genericErrorClassifier,
    headers: {},
    id: 'openai-gpt-4o',
    name: 'OpenAI GPT-4o',
    provider: 'openai',
    model: 'gpt-4o',
    usageProbes: []
  },
  {
    baseUrl: 'https://api.openai.com/v1',
    errorClassifier: genericErrorClassifier,
    headers: {},
    id: 'openai-gpt-4-turbo',
    name: 'OpenAI GPT-4 Turbo',
    provider: 'openai',
    model: 'gpt-4-turbo',
    usageProbes: []
  },
  {
    baseUrl: 'https://api.openai.com/v1',
    errorClassifier: genericErrorClassifier,
    headers: {},
    id: 'openai-gpt-3.5-turbo',
    name: 'OpenAI GPT-3.5 Turbo',
    provider: 'openai',
    model: 'gpt-3.5-turbo',
    usageProbes: []
  }
];
