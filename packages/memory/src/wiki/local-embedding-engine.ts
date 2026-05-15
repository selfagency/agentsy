export interface LocalEmbeddingEngine {
  dimensions: number;
  embed(text: string): number[];
}

export interface LocalEmbeddingEngineOptions {
  dimensions?: number;
}

function normalizeToken(token: string): number {
  let hash = 0;

  for (let index = 0; index < token.length; index += 1) {
    hash = (hash * 31 + token.charCodeAt(index)) >>> 0;
  }

  return hash;
}

export function createLocalEmbeddingEngine(options: LocalEmbeddingEngineOptions = {}): LocalEmbeddingEngine {
  const dimensions = Math.max(4, options.dimensions ?? 32);

  return {
    dimensions,
    embed(text: string) {
      const vector = new Array<number>(dimensions).fill(0);
      const tokens = text.toLowerCase().split(/\s+/).filter(Boolean);

      for (const token of tokens) {
        const hash = normalizeToken(token);
        const position = hash % dimensions;
        const bucketValue = vector[position];
        if (bucketValue !== undefined) {
          vector[position] = bucketValue + 1;
        }
      }

      const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
      if (magnitude === 0) {
        return vector;
      }

      return vector.map(value => value / magnitude);
    },
  };
}
