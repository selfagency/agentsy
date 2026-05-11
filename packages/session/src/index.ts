// @agentsy/session — Session persistence, serialization, and branching
// Initial API scaffold. For broader roadmap context, see plan/MASTER-IMPLEMENTATION-PLAN.md.

export interface SessionState {
  id: string;
  values: Record<string, unknown>;
}

export interface SessionStore {
  getState(): SessionState;
  setValue(key: string, value: unknown): void;
}

export const createSessionStore = (state: SessionState): SessionStore => {
  const values = { ...state.values };

  return {
    getState() {
      return {
        id: state.id,
        values: { ...values },
      };
    },
    setValue(key, value) {
      values[key] = value;
    },
  };
};
