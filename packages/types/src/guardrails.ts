/**
 * Guardrails and policy enforcement types.
 */

import type { ToolId } from './brands.js';

/**
 * Result from evaluating a guardrail.
 */
export interface GuardrailResult {
  /** Whether the guardrail passed. */
  passed: boolean;

  /** Guardrail identifier. */
  guardrailId: string;

  /** Rejection reason if failed. */
  reason?: string;

  /** Optional metadata. */
  metadata?: Record<string, unknown>;
}

/**
 * Configuration for guardrails. */
export interface GuardrailsConfig {
  /** List of enabled guardrail IDs. */
  enabledGuardrails: string[];

  /** Map of guardrail IDs to their configurations. */
  configs: Record<
    string,
    {
      enabled: boolean;
      severity: 'low' | 'medium' | 'high';
      options?: Record<string, unknown>;
    }
  >;

  /** Action on all guardrails passing. */
  passAction: 'allow' | 'warn' | 'log';

  /** Action on any guardrail failing. */
  failAction: 'block' | 'warn' | 'log';
}

/**
 * Interface for a guardrail provider.
 */
export interface GuardrailProvider {
  /** Provider identifier. */
  id: string;

  /** Evaluate input against guardrail. */
  evaluate(input: { content: string; toolId?: ToolId; context?: Record<string, unknown> }): Promise<GuardrailResult>;

  /** Update guardrail configuration. */
  updateConfig(config: { severity?: 'low' | 'medium' | 'high'; options?: Record<string, unknown> }): void;

  /** Get guardrail status. */
  getStatus(): { enabled: boolean; lastEvaluated?: number };
}
