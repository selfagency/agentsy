export type { PrecompressionEvent, PrecompressionPlan } from '../hooks/precompression.js';
export { createPrecompressionPlan } from '../hooks/precompression.js';
export type {
  CompressionMetricRecord,
  CompressionMetricSummaryItem,
  CompressionMetrics,
  CompressionMetricsSummary
} from '../observability/compression-metrics.js';
export { createCompressionMetrics } from '../observability/compression-metrics.js';
export type {
  HydrationCandidate,
  HydrationPolicyInput,
  HydrationPolicyResult
} from '../observability/hydration-policy.js';
export { createHydrationPolicy } from '../observability/hydration-policy.js';
