import type { XmlToolCall } from '@agentsy/core/tool-calls';
import type { UsageInfo } from '@agentsy/types';

export interface AccumulatedMessage {
  thinking: string;
  content: string;
  toolCalls: XmlToolCall[];
  usage?: UsageInfo;
}
