import { anthropicProfiles } from './anthropic.js';
import { bedrockProfiles } from './bedrock.js';
import { deepinfraProfiles } from './deepinfra.js';
import { deepseekProfiles } from './deepseek.js';
import { geminiProfiles } from './gemini.js';
import { mistralProfiles } from './mistral.js';
import { ollamaCloudProfiles, ollamaProfiles } from './ollama.js';
import { openaiProfiles } from './openai.js';
import { perplexityProfiles } from './perplexity.js';
import type { ProviderProfile } from './types.js';
import { xaiProfiles } from './xai.js';
import { zaiProfiles } from './zai.js';

/**
 * Aggregate of all built-in provider profiles shipped with the gateway.
 * Grouped by tier for documentation and capability matching.
 */
export const builtInProfiles: ProviderProfile[] = [
  ...openaiProfiles,
  ...anthropicProfiles,
  ...geminiProfiles,
  ...bedrockProfiles,
  ...mistralProfiles,
  ...deepseekProfiles,
  ...xaiProfiles,
  ...perplexityProfiles,
  ...ollamaCloudProfiles,
  ...deepinfraProfiles,
  ...ollamaProfiles,
  ...zaiProfiles
];

export const tierZeroProfiles: ProviderProfile[] = [...ollamaProfiles, ...zaiProfiles];

export const tierOneProfiles: ProviderProfile[] = [
  ...openaiProfiles,
  ...anthropicProfiles,
  ...geminiProfiles,
  ...bedrockProfiles,
  ...mistralProfiles,
  ...deepseekProfiles,
  ...xaiProfiles,
  ...perplexityProfiles,
  ...ollamaCloudProfiles
];

export const tierTwoProfiles: ProviderProfile[] = [...deepinfraProfiles];
