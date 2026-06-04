/**
 * Diagnostic payload for an AllProvidersExhaustedError. Includes per-provider
 * failure details so operators can see exactly which providers failed and why.
 */
export interface ProviderFailureDetail {
  attempts: number;
  lastError?: string;
  providerId: string;
  reason: string;
}

export class AllProvidersExhaustedError extends Error {
  readonly #failures: ProviderFailureDetail[];

  constructor(failures: ProviderFailureDetail[]) {
    super(
      `All ${failures.length} provider(s) exhausted after retries: ${failures
        .map(f => `${f.providerId} (${f.reason})`)
        .join('; ')}`
    );
    this.name = 'AllProvidersExhaustedError';
    this.#failures = failures;
  }

  get failures(): ProviderFailureDetail[] {
    return [...this.#failures];
  }
}
