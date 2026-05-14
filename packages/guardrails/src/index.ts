/**
 * @agentsy/guardrails
 *
 * Safety and security guardrails for the Agentsy platform.
 */

// TODO: Implement runtime guardrail providers
// This package is 23% complete and needs full implementation (Priority 8)

export interface GuardrailResult {
  passed: boolean;
  guardrailId: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface GuardrailsConfig {
  enabledGuardrails: string[];
  configs: Record<string, { enabled: boolean; severity: 'low' | 'medium' | 'high'; options?: Record<string, unknown> }>;
  passAction: 'allow' | 'warn' | 'log';
  failAction: 'block' | 'warn' | 'log';
}

export interface GuardrailProvider {
  id: string;
  evaluate(input: {
    content: string;
    toolId?: string;
    context?: Record<string, unknown>;
  }): Promise<GuardrailResult>;
  updateConfig(config: {
    severity?: 'low' | 'medium' | 'high';
    options?: Record<string, unknown>;
  }): void;
  getStatus(): { enabled: boolean; lastEvaluated?: number };
}

export interface StreamingGuardrailFilter {
  filter(chunk: string): string | null;
}

export interface RetrievalFirewall {
  checkDomain(domain: string): boolean;
}

export interface TokenQuotaManager {
  checkQuota(exceeded: number): boolean;
}

export class QuotaExceededError extends Error {}
export class RetrievalBlockedError extends Error {}

export class PiiRedactionProvider {}
export class RegexProvider {}
export class OpenAIModerationProvider {}
export class LlamaGuardProvider {}