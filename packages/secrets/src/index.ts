// @agentsy/secrets — Secure secret store, varlock, and keytar integration
// Initial API scaffold. For broader roadmap context, see plan/MASTER-IMPLEMENTATION-PLAN.md.

export interface SecretStore {
  setSecret(key: string, value: string): void;
  getSecret(key: string): string | undefined;
  deleteSecret(key: string): boolean;
}

export const createSecretStore = (): SecretStore => {
  const secrets = new Map<string, string>();

  return {
    setSecret(key, value) {
      secrets.set(key, value);
    },
    getSecret(key) {
      return secrets.get(key);
    },
    deleteSecret(key) {
      return secrets.delete(key);
    },
  };
};
