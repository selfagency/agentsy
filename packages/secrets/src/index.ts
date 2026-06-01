// @agentsy/secrets — Secure secret store, varlock, and keytar integration
// Initial API scaffold. For broader roadmap context, see plan/MASTER-IMPLEMENTATION-PLAN.md.

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
