import type { ContentKind } from '../strategies/content-router.js';

export interface CompressionMetricRecord {
  contentKind: ContentKind;
  inputTokens: number;
  outputTokens: number;
  qualityScore: number;
  recordedAt?: number;
  strategy: string;
}

export interface CompressionMetricSummaryItem {
  averageCompressionRatio: number;
  averageQualityScore: number;
  count: number;
}

export interface CompressionMetricsSummary {
  averageCompressionRatio: number;
  averageQualityScore: number;
  byContentKind: Record<ContentKind, CompressionMetricSummaryItem>;
  byStrategy: Record<string, CompressionMetricSummaryItem>;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalRecords: number;
}

export interface CompressionMetrics {
  compareStrategies(left: string, right: string): CompressionMetricsSummary;
  record(entry: CompressionMetricRecord): void;
  reset(): void;
  summarize(): CompressionMetricsSummary;
}

function createEmptySummaryItem(): CompressionMetricSummaryItem {
  return {
    averageCompressionRatio: 0,
    averageQualityScore: 0,
    count: 0
  };
}

function normalizeRatio(inputTokens: number, outputTokens: number): number {
  if (inputTokens <= 0) {
    return 0;
  }

  return Math.max(0, (inputTokens - outputTokens) / inputTokens);
}

function accumulateItem(item: CompressionMetricSummaryItem, record: CompressionMetricRecord): void {
  item.count += 1;
  item.averageQualityScore += record.qualityScore;
  item.averageCompressionRatio += normalizeRatio(record.inputTokens, record.outputTokens);
}

function finalizeItem(item: CompressionMetricSummaryItem): CompressionMetricSummaryItem {
  if (item.count === 0) {
    return item;
  }

  return {
    averageCompressionRatio: item.averageCompressionRatio / item.count,
    averageQualityScore: item.averageQualityScore / item.count,
    count: item.count
  };
}

function createSkeletonByContentKind(): Record<ContentKind, CompressionMetricSummaryItem> {
  return {
    code: createEmptySummaryItem(),
    diff: createEmptySummaryItem(),
    json: createEmptySummaryItem(),
    log: createEmptySummaryItem(),
    mixed: createEmptySummaryItem(),
    prose: createEmptySummaryItem()
  };
}

function getSummaryItem(
  summary: Record<string, CompressionMetricSummaryItem>,
  key: string
): CompressionMetricSummaryItem {
  for (const [candidateKey, candidateValue] of Object.entries(summary)) {
    if (candidateKey === key) {
      return candidateValue;
    }
  }

  return createEmptySummaryItem();
}

export function createCompressionMetrics(): CompressionMetrics {
  const records: CompressionMetricRecord[] = [];

  function summarize(): CompressionMetricsSummary {
    const byStrategy = new Map<string, CompressionMetricSummaryItem>();
    const byContentKind = createSkeletonByContentKind();
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalQualityScore = 0;

    for (const record of records) {
      totalInputTokens += record.inputTokens;
      totalOutputTokens += record.outputTokens;
      totalQualityScore += record.qualityScore;

      let strategyItem = byStrategy.get(record.strategy);
      if (strategyItem === undefined) {
        strategyItem = createEmptySummaryItem();
        byStrategy.set(record.strategy, strategyItem);
      }
      accumulateItem(strategyItem, record);

      const contentItem = byContentKind[record.contentKind];
      accumulateItem(contentItem, record);
    }

    const finalizedByStrategy = Object.fromEntries(
      [...byStrategy.entries()].map(([key, item]) => [key, finalizeItem(item)])
    );

    return {
      averageCompressionRatio:
        records.length === 0 ? 0 : Math.max(0, (totalInputTokens - totalOutputTokens) / totalInputTokens),
      averageQualityScore: records.length === 0 ? 0 : totalQualityScore / records.length,
      byContentKind: {
        code: finalizeItem(byContentKind.code),
        diff: finalizeItem(byContentKind.diff),
        json: finalizeItem(byContentKind.json),
        log: finalizeItem(byContentKind.log),
        mixed: finalizeItem(byContentKind.mixed),
        prose: finalizeItem(byContentKind.prose)
      },
      byStrategy: finalizedByStrategy,
      totalInputTokens,
      totalOutputTokens,
      totalRecords: records.length
    };
  }

  return {
    compareStrategies(left, right) {
      const summary = summarize();
      return {
        ...summary,
        byStrategy: Object.fromEntries([
          [left, getSummaryItem(summary.byStrategy, left)],
          [right, getSummaryItem(summary.byStrategy, right)]
        ])
      };
    },

    record(entry) {
      records.push(entry);
    },

    reset() {
      records.length = 0;
    },

    summarize
  };
}
