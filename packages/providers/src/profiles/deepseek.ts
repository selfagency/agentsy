import { genericErrorClassifier } from './error-classifier.js';
import type { ProviderProfile } from './types.js';

const balanceProbe = {
  authPrefix: 'Bearer',
  kind: 'api' as const,
  path: '/user/balance'
};

export const deepseekProfiles: ProviderProfile[] = [
  {
    baseUrl: 'https://api.deepseek.com/v1',
    errorClassifier: genericErrorClassifier,
    headers: {},
    id: 'deepseek-chat',
    name: 'DeepSeek Chat',
    provider: 'openai',
    model: 'deepseek-chat',
    usageProbes: [balanceProbe]
  },
  {
    baseUrl: 'https://api.deepseek.com/v1',
    errorClassifier: genericErrorClassifier,
    headers: {},
    id: 'deepseek-coder',
    name: 'DeepSeek Coder',
    provider: 'openai',
    model: 'deepseek-coder',
    usageProbes: [balanceProbe]
  }
];
