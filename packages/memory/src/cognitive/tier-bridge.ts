import type { Compressor, CompressResult } from './compressor.js';
import type { Summarizer, SummarizeResult } from './summarizer.js';
import type { Synthesizer, SynthesizeResult } from './synthesizer.js';
import type { MemoryItem, TierName } from './tier-types.js';

export interface TierBridge {
  from: TierName;
  to: TierName;
  transfer(items: MemoryItem[], reason: 'consolidation' | 'eviction' | 'manual'): number;
  canTransfer(): boolean;
}

export type TierTransform = (items: MemoryItem[]) => MemoryItem[];

const identityTransform: TierTransform = items => items;

export interface TierBridgeOptions {
  from: TierName;
  to: TierName;
  transform?: TierTransform | undefined;
}

export function createTierBridge(options: TierBridgeOptions): TierBridge {
  const { from, to } = options;
  const transform = options.transform ?? identityTransform;

  return {
    from,
    to,

    canTransfer(): boolean {
      return true;
    },

    transfer(items: MemoryItem[], _reason: 'consolidation' | 'eviction' | 'manual'): number {
      if (!this.canTransfer()) return 0;
      const transformed = transform(items);
      return transformed.length;
    }
  };
}

export interface TierBridgeWithDataOptions {
  from: TierName;
  to: TierName;
  transform?: TierTransform | undefined;
  compressor?: Compressor | undefined;
  synthesizer?: Synthesizer | undefined;
  summarizer?: Summarizer | undefined;
  budget?: number;
}

export function createTierBridgeWithData(
  options: TierBridgeWithDataOptions,
  sourceTier: {
    items(): readonly MemoryItem[];
    promote(count: number, to: { write(item: MemoryItem): MemoryItem | null }): number;
  },
  targetTier: { write(item: MemoryItem): MemoryItem | null }
): TierBridge & {
  promoteItems(count: number): number;
  compressAndPromote(count: number, budget: number): number;
  synthesizeAndPromote(count: number, budget: number): number;
  summarizeAndPromote(count: number, budget: number): number;
} {
  const bridge = createTierBridge({
    from: options.from,
    to: options.to,
    transform: options.transform
  });

  return {
    ...bridge,

    promoteItems(count: number): number {
      return sourceTier.promote(count, targetTier);
    },

    compressAndPromote(count: number, budget: number): number {
      if (!options.compressor) return 0;
      const allItems = [...sourceTier.items()];
      const toProcess = allItems.slice(0, count);
      const result: CompressResult = options.compressor.compress(toProcess, budget);
      let promoted = 0;
      for (const chunk of result.chunks) {
        const written = targetTier.write(chunk);
        if (written !== null) promoted++;
      }
      return promoted;
    },

    synthesizeAndPromote(count: number, budget: number): number {
      if (!options.synthesizer) return 0;
      const allItems = [...sourceTier.items()];
      const toProcess = allItems.slice(0, count);
      const result: SynthesizeResult = options.synthesizer.synthesize(toProcess, budget);
      let promoted = 0;
      for (const item of result.synthesized) {
        const written = targetTier.write(item);
        if (written !== null) promoted++;
      }
      return promoted;
    },

    summarizeAndPromote(count: number, budget: number): number {
      if (!options.summarizer) return 0;
      const allItems = [...sourceTier.items()];
      const toProcess = allItems.slice(0, count);
      const result: SummarizeResult = options.summarizer.summarize(toProcess, budget);
      let promoted = 0;
      for (const item of result.longTermItems) {
        const written = targetTier.write(item);
        if (written !== null) promoted++;
      }
      return promoted;
    }
  };
}
