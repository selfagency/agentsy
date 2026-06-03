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
  audioInput?: boolean;
  audioOutput?: boolean;
  imageInput?: boolean;
  imageOutput?: boolean;
  reasoning?: boolean;
  streaming?: boolean;
  toolCalling?: boolean;
}

/**
 * Minimal model shape needed to extract capabilities.
 */
export interface ModelRecordLike {
  modalities: { input: readonly string[]; output: readonly string[] };
  reasoning: boolean;
  tool_call: boolean;
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
    reasoning: modelCapabilities.reasoning
  };
}

/**
 * Extract model capabilities from a models.dev model record.
 */
export function extractModelCapabilities(model: ModelRecordLike): ModelCapabilities {
  return {
    audioInput: model.modalities.input.includes('audio'),
    audioOutput: model.modalities.output.includes('audio'),
    imageInput: model.modalities.input.includes('image'),
    imageOutput: model.modalities.output.includes('image'),
    reasoning: model.reasoning,
    streaming: true,
    toolCalling: model.tool_call
  };
}

/**
 * Mutable state for capability checking
 */
interface CapabilityCheckState {
  matchCount: number;
  missingCapabilities: string[];
  totalRequired: number;
}

/**
 * Check a simple boolean capability (streaming, toolCalling, reasoning, batching)
 */
function checkSimpleCapability(
  requiredValue: boolean | undefined,
  providedValue: boolean | undefined,
  capName: string,
  state: CapabilityCheckState
): void {
  if (requiredValue !== undefined) {
    state.totalRequired++;
    if (providedValue === requiredValue) {
      state.matchCount++;
    } else if (requiredValue && !providedValue) {
      state.missingCapabilities.push(capName);
    }
  }
}

/**
 * Check budgeting capability (has nested sub-capabilities)
 */
function checkBudgetingCapability(
  required: ProviderCapabilities['budgeting'],
  provided: ProviderCapabilities['budgeting'],
  state: CapabilityCheckState
): void {
  if (!required) {
    return;
  }

  if (required.supportsCostTracking !== undefined) {
    state.totalRequired++;
    if (provided?.supportsCostTracking === required.supportsCostTracking) {
      state.matchCount++;
    } else if (required.supportsCostTracking && !provided?.supportsCostTracking) {
      state.missingCapabilities.push('costTracking');
    }
  }

  if (required.supportsTokenBudgeting !== undefined) {
    state.totalRequired++;
    if (provided?.supportsTokenBudgeting === required.supportsTokenBudgeting) {
      state.matchCount++;
    } else if (required.supportsTokenBudgeting && !provided?.supportsTokenBudgeting) {
      state.missingCapabilities.push('tokenBudgeting');
    }
  }
}

/**
 * Check if a provider's capabilities match model requirements
 */
export function matchCapabilities(
  required: ProviderCapabilities,
  provided: ProviderCapabilities
): CapabilityMatchResult {
  const state: CapabilityCheckState = { matchCount: 0, totalRequired: 0, missingCapabilities: [] };

  checkSimpleCapability(required.streaming, provided.streaming, 'streaming', state);
  checkSimpleCapability(required.toolCalling, provided.toolCalling, 'toolCalling', state);
  checkSimpleCapability(required.reasoning, provided.reasoning, 'reasoning', state);
  checkSimpleCapability(required.batching, provided.batching, 'batching', state);
  checkBudgetingCapability(required.budgeting, provided.budgeting, state);

  const score = state.totalRequired > 0 ? state.matchCount / state.totalRequired : 1;
  const matches = state.missingCapabilities.length === 0;

  return {
    providerId: '',
    matches,
    missingCapabilities: state.missingCapabilities,
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
