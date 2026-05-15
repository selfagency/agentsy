/**
 * @agentsy/guardrails
 *
 * Safety and security guardrails for the Agentsy platform.
 */

export class QuotaExceededError extends Error {
  constructor(message = 'Token quota exceeded') {
    super(message);
    this.name = 'QuotaExceededError';
  }
}
export class RetrievalBlockedError extends Error {
  constructor(message = 'Retrieval request blocked by firewall') {
    super(message);
    this.name = 'RetrievalBlockedError';
  }
}
