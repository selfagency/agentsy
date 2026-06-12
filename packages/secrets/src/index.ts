// @agentsy/secrets — Secure secret store, varlock, and keytar integration
// For broader roadmap context, see plan/MASTER-IMPLEMENTATION-PLAN.md.

export interface SecretStore {
  deleteSecret(key: string): boolean;
  getSecret(key: string): string | undefined;
  setSecret(key: string, value: string): void;
}

export const createSecretStore = (): SecretStore => {
  const secrets = new Map<string, string>();

  return {
    deleteSecret(key) {
      return secrets.delete(key);
    },
    getSecret(key) {
      return secrets.get(key);
    },
    setSecret(key, value) {
      secrets.set(key, value);
    }
  };
};

// Broker
export type { Keyring } from './broker/index.js';
export { CredentialBroker, InMemoryKeyring } from './broker/index.js';
export type { AuditEntry, CredentialRequest, IssuedCredential, ResourceType } from './broker/types.js';
export { MissingCredentialError } from './broker/types.js';
export type { SecretMatch } from './detection/index.js';
// Detection
export { createSecretDetectionHook, detectSecrets, redactSecrets } from './detection/index.js';
