import { genericErrorClassifier } from './generic-error-classifier.js';
import type { ProviderProfile } from './types.js';

export const geminiProfiles: ProviderProfile[] = [
  {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    errorClassifier: genericErrorClassifier,
    headers: {},
    id: 'gemini-2.5-pro',
    name: 'Google Gemini 2.5 Pro',
    provider: 'gemini',
    model: 'gemini-2.5-pro',
    usageProbes: []
  },
  {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    errorClassifier: genericErrorClassifier,
    headers: {},
    id: 'gemini-2-flash',
    name: 'Google Gemini 2.0 Flash',
    provider: 'gemini',
    model: 'gemini-2.0-flash',
    usageProbes: []
  }
];
