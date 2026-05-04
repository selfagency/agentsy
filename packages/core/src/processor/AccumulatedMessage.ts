import type { UsageInfo } from '../normalizers/types.js';
import type { XmlToolCall } from '@agentsy/tool-calls';

export interface AccumulatedMessage {
  thinking: string;
  content: string;
  toolCalls: XmlToolCall[];
  usage?: UsageInfo;
}
