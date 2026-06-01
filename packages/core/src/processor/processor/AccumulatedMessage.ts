import type { XmlToolCall } from '../../tool-calls/index.js';
import type { UsageInfo } from '@agentsy/types';

export interface AccumulatedMessage {
  thinking: string;
  content: string;
  toolCalls: XmlToolCall[];
  usage?: UsageInfo;
}
