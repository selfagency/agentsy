import type { StreamChunk } from '@agentsy/types';

export type { NativeToolCallDelta, UsageInfo } from '@agentsy/types';

/** The result of normalizing a provider-specific streaming chunk into a canonical StreamChunk. */
export interface NormalizerResult {
  chunk: StreamChunk;
  rawEvent?: unknown;
}
