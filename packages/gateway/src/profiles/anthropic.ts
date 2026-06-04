import { genericErrorClassifier } from './generic-error-classifier.js';
import type { ProviderProfile } from './types.js';

const anthropicHeaders = {
  'anthropic-version': '2023-06-01'
};

const usageWindowProbe = {
  authPrefix: 'x-api-key',
  kind: 'api' as const,
  path: '/usage'
};

export const anthropicProfiles: ProviderProfile[] = [
  {
    baseUrl: 'https://api.anthropic.com/v1',
    errorClassifier: genericErrorClassifier,
    headers: anthropicHeaders,
    id: 'anthropic-claude-opus-4',
    name: 'Anthropic Claude Opus 4',
    provider: 'anthropic',
    model: 'claude-opus-4-20250514',
    usageProbes: [usageWindowProbe]
  },
  {
    baseUrl: 'https://api.anthropic.com/v1',
    errorClassifier: genericErrorClassifier,
    headers: anthropicHeaders,
    id: 'anthropic-claude-sonnet-4-5',
    name: 'Anthropic Claude Sonnet 4.5',
    provider: 'anthropic',
    model: 'claude-sonnet-4-5-20250929',
    usageProbes: [usageWindowProbe]
  },
  {
    baseUrl: 'https://api.anthropic.com/v1',
    errorClassifier: genericErrorClassifier,
    headers: anthropicHeaders,
    id: 'anthropic-claude-haiku',
    name: 'Anthropic Claude Haiku',
    provider: 'anthropic',
    model: 'claude-3-5-haiku-20241022',
    usageProbes: [usageWindowProbe]
  }
];
