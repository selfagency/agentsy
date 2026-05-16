export interface VersionTracker {
  bump(pageId: string): number;
  current(pageId: string): number;
  history(pageId: string): readonly number[];
}

export function createVersionTracker(): VersionTracker {
  const versions = new Map<string, number>();
  const versionHistory = new Map<string, number[]>();

  return {
    bump(pageId: string) {
      const nextVersion = (versions.get(pageId) ?? 0) + 1;
      versions.set(pageId, nextVersion);

      const history = versionHistory.get(pageId) ?? [];
      history.push(nextVersion);
      versionHistory.set(pageId, history);

      return nextVersion;
    },

    current(pageId: string) {
      return versions.get(pageId) ?? 0;
    },

    history(pageId: string) {
      return [...(versionHistory.get(pageId) ?? [])];
    }
  };
}
