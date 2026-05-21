import type { KvStore } from '../../filesystem/agentfs/kv-store.js';
import { createKvStore } from '../../filesystem/agentfs/kv-store.js';

export interface PersonaAttribute {
  key: string;
  value: string;
  confidence: number;
  sourceIds: string[];
  updatedAt: number;
}

export interface CommunicationProfile {
  tone?: string;
  verbosity: 'concise' | 'moderate' | 'verbose';
  prefersExamples: boolean;
  codeStyle?: string;
}

export interface PersonaMemory {
  userId: string;
  attributes: PersonaAttribute[];
  preferences: Record<string, unknown>;
  communicationStyle: CommunicationProfile;
  updatedAt: number;
}

export interface PersonaPatch {
  attributes?: PersonaAttribute[];
  preferences?: Record<string, unknown>;
  communicationStyle?: Partial<CommunicationProfile>;
}

export interface PersonaStore {
  get(userId: string): PersonaMemory | undefined;
  update(userId: string, patch: PersonaPatch): PersonaMemory;
  listAttributes(userId: string): PersonaAttribute[];
  listUserIds(): string[];
  delete(userId: string): boolean;
}

export interface PersonaStoreOptions {
  kvStore?: KvStore<PersonaMemory>;
  now?: (() => number) | undefined;
}

function deepMergePreferences(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!incoming) return existing;
  const merged = { ...existing };
  for (const [key, value] of Object.entries(incoming)) {
    merged[key] = value;
  }
  return merged;
}

function mergeAttributes(existing: PersonaAttribute[], incoming: PersonaAttribute[] | undefined): PersonaAttribute[] {
  if (!incoming) return existing;
  const merged = new Map<string, PersonaAttribute>();

  for (const attr of existing) {
    merged.set(attr.key, attr);
  }

  for (const attr of incoming) {
    const current = merged.get(attr.key);
    if (current) {
      // Merge: keep higher confidence, combine sourceIds, update timestamp
      merged.set(attr.key, {
        ...attr,
        confidence: Math.max(current.confidence, attr.confidence),
        sourceIds: [...new Set([...current.sourceIds, ...attr.sourceIds])],
        updatedAt: Math.max(current.updatedAt, attr.updatedAt)
      });
    } else {
      merged.set(attr.key, attr);
    }
  }

  return [...merged.values()];
}

function defaultProfile(): CommunicationProfile {
  return {
    verbosity: 'moderate',
    prefersExamples: true
  };
}

function mergeProfile(
  existing: CommunicationProfile,
  incoming: Partial<CommunicationProfile> | undefined
): CommunicationProfile {
  if (!incoming) return existing;
  const merged: CommunicationProfile = {
    verbosity: incoming.verbosity ?? existing.verbosity,
    prefersExamples: incoming.prefersExamples ?? existing.prefersExamples
  };
  if (incoming.tone !== undefined) {
    merged.tone = incoming.tone;
  } else if (existing.tone !== undefined) {
    merged.tone = existing.tone;
  }
  if (incoming.codeStyle !== undefined) {
    merged.codeStyle = incoming.codeStyle;
  } else if (existing.codeStyle !== undefined) {
    merged.codeStyle = existing.codeStyle;
  }
  return merged;
}

export function createPersonaStore(options: PersonaStoreOptions = {}): PersonaStore {
  const kv = options.kvStore ?? createKvStore<PersonaMemory>();
  const now = options.now ?? (() => performance.now());

  function defaultPersona(userId: string): PersonaMemory {
    return {
      userId,
      attributes: [],
      preferences: {},
      communicationStyle: defaultProfile(),
      updatedAt: now()
    };
  }

  return {
    get(userId: string): PersonaMemory | undefined {
      return kv.get(userId);
    },

    update(userId: string, patch: PersonaPatch): PersonaMemory {
      const existing = kv.get(userId) ?? defaultPersona(userId);
      const currentNow = now();

      const updated: PersonaMemory = {
        userId,
        attributes: mergeAttributes(existing.attributes, patch.attributes),
        preferences: deepMergePreferences(existing.preferences, patch.preferences),
        communicationStyle: mergeProfile(existing.communicationStyle, patch.communicationStyle),
        updatedAt: currentNow
      };

      kv.set(userId, updated);
      return updated;
    },

    listAttributes(userId: string): PersonaAttribute[] {
      const persona = kv.get(userId);
      if (!persona) return [];
      return [...persona.attributes].sort((a, b) => b.confidence - a.confidence);
    },

    listUserIds(): string[] {
      return kv.keys();
    },

    delete(userId: string): boolean {
      return kv.delete(userId);
    }
  };
}
