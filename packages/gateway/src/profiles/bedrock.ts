import { genericErrorClassifier } from './generic-error-classifier.js';
import type { ProviderProfile } from './types.js';

const bedrockHeaders = {
  'x-provider': 'bedrock'
};

export const bedrockProfiles: ProviderProfile[] = [
  {
    baseUrl: 'https://bedrock-runtime.us-east-1.amazonaws.com',
    errorClassifier: genericErrorClassifier,
    headers: bedrockHeaders,
    id: 'bedrock-claude-3-5-sonnet',
    name: 'AWS Bedrock Claude 3.5 Sonnet',
    provider: 'bedrock',
    model: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
    usageProbes: []
  },
  {
    baseUrl: 'https://bedrock-runtime.us-east-1.amazonaws.com',
    errorClassifier: genericErrorClassifier,
    headers: bedrockHeaders,
    id: 'bedrock-llama-3-70b',
    name: 'AWS Bedrock Llama 3 70B',
    provider: 'bedrock',
    model: 'meta.llama3-70b-instruct-v1:0',
    usageProbes: []
  }
];
