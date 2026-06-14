/**
 * Credential resolution for provider configs.
 *
 * Resolves `secretRef` and `secretId` fields from ProviderConfig through
 * the @agentsy/secrets CredentialBroker at runtime. Config files NEVER
 * store plaintext API keys.
 *
 * ## Resolution order
 *
 * 1. `secretId` — looks up an already-issued credential by ID in the broker
 * 2. `secretRef` — issues a new credential via the broker's keyring
 * 3. Neither — returns undefined (provider may not need auth, e.g. Ollama)
 */

import type { CredentialBroker, Keyring } from '@agentsy/secrets';
import type { ProviderConfig } from './schema.js';

/**
 * Resolve a provider's credential from its config.
 *
 * @returns The decrypted API key, or undefined if no credential is configured.
 */
export async function resolveProviderCredential(
  provider: ProviderConfig,
  broker: CredentialBroker
): Promise<string | undefined> {
  // 1. secretId — look up an already-issued credential
  if (provider.secretId) {
    try {
      return await broker.resolve(provider.secretId);
    } catch {
      return;
    }
  }

  // 2. secretRef — issue a new credential
  if (provider.secretRef) {
    try {
      const credential = await broker.issue({
        resourceType: provider.type,
        requestedScopes: ['llm:inference'],
        justification: `Resolve API key for provider ${provider.id}`,
        sessionId: 'config-loader',
        ttlSeconds: 3600 // 1 hour for config-loaded credentials
      });
      return await broker.resolve(credential.id);
    } catch {
      return;
    }
  }

  // 3. No credential configured
  return;
}

/**
 * Create a keyring pre-populated with provider credentials from environment
 * variables. This is a convenience for local development where secrets are
 * injected via env vars rather than a secret store.
 *
 * Supported env vars:
 * - AGENTSY_OPENAI_KEY
 * - AGENTSY_ANTHROPIC_KEY
 * - AGENTSY_OLLAMA_KEY (rare, but supported)
 */
export function createEnvKeyring(): Keyring {
  const entries: [string, string][] = [];

  const openaiKey = process.env.AGENTSY_OPENAI_KEY;
  if (openaiKey) {
    entries.push(['openai', openaiKey]);
  }

  const anthropicKey = process.env.AGENTSY_ANTHROPIC_KEY;
  if (anthropicKey) {
    entries.push(['anthropic', anthropicKey]);
  }

  const ollamaKey = process.env.AGENTSY_OLLAMA_KEY;
  if (ollamaKey) {
    entries.push(['ollama', ollamaKey]);
  }

  return {
    get(resourceType: string): Promise<string | undefined> {
      const entry = entries.find(([key]) => key === resourceType);
      return Promise.resolve(entry?.[1]);
    }
  };
}
