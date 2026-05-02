// Module-level LRU cache for ANSI output (500 entries)
const tokenCache = new Map<string, string>();
const MAX_CACHE_SIZE = 500;

export function getCachedAnsi(content: string, render: (s: string) => string): string {
  const key = content;
  const cached = tokenCache.get(key);
  if (cached !== undefined) {
    return cached;
  }

  const result = render(content);
  tokenCache.set(key, result);

  // Evict oldest if over limit
  if (tokenCache.size > MAX_CACHE_SIZE) {
    const firstKey = tokenCache.keys().next().value;
    if (firstKey !== undefined) {
      tokenCache.delete(firstKey);
    }
  }

  return result;
}
