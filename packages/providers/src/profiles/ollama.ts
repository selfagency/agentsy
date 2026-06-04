import { genericErrorClassifier } from './error-classifier.js';
import type { ProviderProfile } from './types.js';

const localTagsProbe = {
  kind: 'local' as const,
  path: '/api/tags'
};

export const ollamaProfiles: ProviderProfile[] = [
  {
    baseUrl: 'http://localhost:11434/v1',
    errorClassifier: genericErrorClassifier,
    headers: {},
    id: 'ollama-local-llama3',
    name: 'Ollama Local Llama 3',
    provider: 'openai',
    model: 'llama3',
    usageProbes: [localTagsProbe]
  },
  {
    baseUrl: 'http://localhost:11434/v1',
    errorClassifier: genericErrorClassifier,
    headers: {},
    id: 'ollama-local-mistral',
    name: 'Ollama Local Mistral',
    provider: 'openai',
    model: 'mistral',
    usageProbes: [localTagsProbe]
  }
];

export const ollamaCloudProfiles: ProviderProfile[] = [
  {
    baseUrl: 'https://ollama.com/v1',
    errorClassifier: genericErrorClassifier,
    headers: {},
    id: 'ollama-cloud-llama3',
    name: 'Ollama Cloud Llama 3',
    provider: 'openai',
    model: 'llama3',
    usageProbes: []
  }
];
