export interface ReusableMemoryBlock {
  fingerprint: string;
  reuseClass: "hot" | "warm" | "cold";
  hitCount: number;
  invalidations: string[];
}

function reuseRank(reuseClass: ReusableMemoryBlock["reuseClass"]): number {
  switch (reuseClass) {
    case "hot": {
      return 0;
    }
    case "warm": {
      return 1;
    }
    case "cold": {
      return 2;
    }
  }
}

export function rankReusableMemoryBlocks(
  blocks: ReusableMemoryBlock[],
  fingerprint: string,
  invalidatedKeys: readonly string[] = []
): ReusableMemoryBlock[] {
  return [...blocks]
    .filter((block) => block.reuseClass !== "cold")
    .filter((block) =>
      invalidatedKeys.every((key) => !block.invalidations.includes(key))
    )
    .toSorted((left, right) => {
      if (
        left.fingerprint === fingerprint &&
        right.fingerprint !== fingerprint
      ) {
        return -1;
      }

      if (
        right.fingerprint === fingerprint &&
        left.fingerprint !== fingerprint
      ) {
        return 1;
      }

      const reuseDelta =
        reuseRank(left.reuseClass) - reuseRank(right.reuseClass);
      if (reuseDelta !== 0) {
        return reuseDelta;
      }

      return right.hitCount - left.hitCount;
    });
}
