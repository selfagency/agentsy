import type { ProviderProfile } from './types.js';

export class ProfileRegistry {
  #profiles = new Map<string, ProviderProfile>();

  register(profile: ProviderProfile): void {
    this.#profiles.set(profile.id, profile);
  }

  get(id: string): ProviderProfile | undefined {
    return this.#profiles.get(id);
  }

  detectFromUrl(url: string): ProviderProfile | undefined {
    for (const profile of this.#profiles.values()) {
      if (profile.baseUrl !== undefined && url.startsWith(profile.baseUrl)) {
        return profile;
      }
    }
    return undefined;
  }

  detectFromHeaders(headers: Record<string, string>): ProviderProfile | undefined {
    const normalized = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
    for (const profile of this.#profiles.values()) {
      for (const [header, value] of Object.entries(profile.headers)) {
        if (normalized[header.toLowerCase()] === value) {
          return profile;
        }
      }
    }
    return undefined;
  }
}
