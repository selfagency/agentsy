/**
 * Guardrails configuration
 */
export interface GuardrailsConfig {
  providers: string[];
  allowedTopics?: string[];
  blockedTopics?: string[];
  piiRedaction?: boolean;
  tokenQuota?: {
    maxSessionTokens: number;
  };
  retrievalDomains?: string[];
  trustHierarchy?: 'system' | 'user' | 'retrieved';
  egressAllowList?: string[];
  crossUserDataAccess?: boolean;
  stripUntrustedContext?: boolean;
}

/**
 * Guardrail result with typed events
 */
export interface GuardrailResult {
  blocked: boolean;
  reason?: string;
  category?: string;
  piiRedacted?: boolean;
  redactedFields?: string[];
  inScope?: boolean;
  intent?: string;
  confidence?: number;
}

/**
 * Typed observability events for guardrails
 */
export const GuardrailsEventCategory = {
  blocked: 'guardrail:blocked',
  piiRedacted: 'guardrail:pii-redacted',
  quotaExceeded: 'guardrail:quota-exceeded'
} as const;

export type GuardrailEventCategory = typeof GuardrailsEventCategory;

/**
 * Guardrail provider interface
 */
export interface GuardrailProvider {
  process(message: string): Promise<GuardrailResult>;
}

/**
 * Streaming guardrail filter for chunk-level processing
 */
export interface StreamingGuardrailFilter {
  filter(chunk: string): string;
  getCategory(): string;
}

/**
 * Retrieval domain firewall
 */
export interface RetrievalFirewall {
  validate(url: string): boolean;
}

/**
 * Token quota manager
 */
export interface TokenQuotaManager {
  consume(tokens: number): void;
  getMaxTokens(): number;
  getCurrentTokens(): number;
}

/**
 * Max tokens exceeded error
 */
export class QuotaExceededError extends Error {
  constructor(message = 'Token quota exceeded for current session') {
    super(message);
    this.name = 'QuotaExceededError';
  }
}

/**
 * Retrieval domain blocked error
 */
export class RetrievalBlockedError extends Error {
  constructor(message = 'Retrieval domain not in allowlist') {
    super(message);
    this.name = 'RetrievalBlockedError';
  }
}

/**
 * PII redaction provider
 */
export abstract class PiiRedactionProvider implements GuardrailProvider {
  abstract process(message: string): Promise<GuardrailResult>;
}

/**
 * Regex-based guardrail provider
 */
export abstract class RegexProvider implements GuardrailProvider {
  abstract process(message: string): Promise<GuardrailResult>;
}

/**
 * Built-in OpenAI moderation provider (optional, requires openai peer dep)
 */
export abstract class OpenAIModerationProvider implements GuardrailProvider {
  abstract process(message: string): Promise<GuardrailResult>;
}

/**
 * Llama Guard provider (optional, requires OpenAI-compatible client)
 */
export abstract class LlamaGuardProvider implements GuardrailProvider {
  abstract process(message: string): Promise<GuardrailResult>;
}