/**
 * Capability Bridge: Maps model capabilities to provider capabilities
 *
 * Bridges the gap between @agentsy/models (model selection) and @agentsy/providers
 * (provider capabilities). Enables model-aware provider selection and capability gating.
 */

import type { ProviderCapabilities } from './index.js';

/**
 * Model capability requirements from @agentsy/models
 */
export interface ModelCapabilities {
  batching?: boolean;
  costTracking?: boolean;
  reasoning?: boolean;
  streaming?: boolean;
  tokenBudgeting?: boolean;
  toolCalling?: boolean;
}

/**
 * Provider capability profile with metadata
 */
export interface ProviderCapabilityProfile {
  capabilities: ProviderCapabilities;
  metadata?:
    | {
        localOnly?: boolean | undefined;
        cloudOnly?: boolean | undefined;
        requiresAuth?: boolean | undefined;
        requiresSetup?: boolean | undefined;
      }
    | undefined;
  providerId: string;
}

/**
 * Capability match result
 */
export interface CapabilityMatchResult {
  matches: boolean;
  missingCapabilities: string[];
  providerId: string;
  score: number; // 0-1, higher is better
}

/**
 * Convert model capabilities to provider capability requirements
 */
export function modelCapabilitiesToProviderRequirements(modelCapabilities: ModelCapabilities): ProviderCapabilities {
  return {
    streaming: modelCapabilities.streaming,
    toolCalling: modelCapabilities.toolCalling,
    reasoning: modelCapabilities.reasoning,
    batching: modelCapabilities.batching,
    ...(modelCapabilities.costTracking || modelCapabilities.tokenBudgeting
      ? {
          budgeting: {
            supportsCostTracking: modelCapabilities.costTracking,
            supportsTokenBudgeting: modelCapabilities.tokenBudgeting
          }
        }
      : {})
  };
}

/**
 * Check if a provider's capabilities match model requirements
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: will refactor later
export function matchCapabilities(
  required: ProviderCapabilities,
  provided: ProviderCapabilities
): CapabilityMatchResult {
  const missingCapabilities: string[] = [];
  let matchCount = 0;
  let totalRequired = 0;

  // Check streaming
  if (required.streaming !== undefined) {
    totalRequired++;
    if (provided.streaming === required.streaming) {
      matchCount++;
    } else if (required.streaming && !provided.streaming) {
      missingCapabilities.push('streaming');
    }
  }

  // Check tool calling
  if (required.toolCalling !== undefined) {
    totalRequired++;
    if (provided.toolCalling === required.toolCalling) {
      matchCount++;
    } else if (required.toolCalling && !provided.toolCalling) {
      missingCapabilities.push('toolCalling');
    }
  }

  // Check reasoning
  if (required.reasoning !== undefined) {
    totalRequired++;
    if (provided.reasoning === required.reasoning) {
      matchCount++;
    } else if (required.reasoning && !provided.reasoning) {
      missingCapabilities.push('reasoning');
    }
  }

  // Check batching
  if (required.batching !== undefined) {
    totalRequired++;
    if (provided.batching === required.batching) {
      matchCount++;
    } else if (required.batching && !provided.batching) {
      missingCapabilities.push('batching');
    }
  }

  // Check budgeting
  if (required.budgeting) {
    if (required.budgeting.supportsCostTracking !== undefined) {
      totalRequired++;
      if (provided.budgeting?.supportsCostTracking === required.budgeting.supportsCostTracking) {
        matchCount++;
      } else if (required.budgeting.supportsCostTracking && !provided.budgeting?.supportsCostTracking) {
        missingCapabilities.push('costTracking');
      }
    }

    if (required.budgeting.supportsTokenBudgeting !== undefined) {
      totalRequired++;
      if (provided.budgeting?.supportsTokenBudgeting === required.budgeting.supportsTokenBudgeting) {
        matchCount++;
      } else if (required.budgeting.supportsTokenBudgeting && !provided.budgeting?.supportsTokenBudgeting) {
        missingCapabilities.push('tokenBudgeting');
      }
    }
  }

  const score = totalRequired > 0 ? matchCount / totalRequired : 1;
  const matches = missingCapabilities.length === 0;

  return {
    providerId: '',
    matches,
    missingCapabilities,
    score
  };
}

/**
 * Filter providers by capability requirements
 */
export function filterProvidersByCapabilities(
  providers: ProviderCapabilityProfile[],
  required: ProviderCapabilities
): CapabilityMatchResult[] {
  return providers
    .map(provider => {
      const result = matchCapabilities(required, provider.capabilities);
      return {
        ...result,
        providerId: provider.providerId
      };
    })
    .sort((a, b) => {
      // Sort by match first, then by score
      if (a.matches !== b.matches) {
        return a.matches ? -1 : 1;
      }
      return b.score - a.score;
    });
}

/**
 * Get the best matching provider for model capabilities
 */
export function selectBestProvider(
  providers: ProviderCapabilityProfile[],
  required: ProviderCapabilities
): ProviderCapabilityProfile | null {
  const matches = filterProvidersByCapabilities(providers, required);
  const bestMatch = matches.find(m => m.matches);

  if (!bestMatch) {
    return null;
  }

  return providers.find(p => p.providerId === bestMatch.providerId) ?? null;
}

/**
 * Build a capability profile for a provider
 */
export function buildProviderCapabilityProfile(
  providerId: string,
  capabilities: ProviderCapabilities,
  metadata?: ProviderCapabilityProfile['metadata']
): ProviderCapabilityProfile {
  return {
    providerId,
    capabilities,
    metadata
  };
}
