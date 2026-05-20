export interface NavigationSystem {
  linkPages(fromPageId: string, toPageId: string): void;
  getOutgoing(pageId: string): string[];
  getBacklinks(pageId: string): string[];
}

export function createNavigationSystem(): NavigationSystem {
  const outgoing = new Map<string, Set<string>>();

  function getOrCreate(pageId: string): Set<string> {
    const existing = outgoing.get(pageId);
    if (existing) {
      return existing;
    }

    const created = new Set<string>();
    outgoing.set(pageId, created);
    return created;
  }

  return {
    getBacklinks(pageId: string) {
      const backlinks: string[] = [];

      for (const [fromPageId, targets] of outgoing.entries()) {
        if (targets.has(pageId)) {
          backlinks.push(fromPageId);
        }
      }

      return backlinks;
    },

    getOutgoing(pageId: string) {
      return [...(outgoing.get(pageId) ?? new Set<string>())];
    },

    linkPages(fromPageId: string, toPageId: string) {
      getOrCreate(fromPageId).add(toPageId);
      getOrCreate(toPageId);
    }
  };
}
