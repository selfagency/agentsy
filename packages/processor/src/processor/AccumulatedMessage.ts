import type { UsageInfo } from '@agentsy/types';
import type { XmlToolCall } from '@agentsy/tool-calls';

export interface AccumulatedMessage {
  thinking: string;
  content: string;
  toolCalls: XmlToolCall[];
  usage?: UsageInfo;
}
