import type { UsageInfo } from '../normalizers/types.js';
import type { XmlToolCall } from '../tool-calls/extractXmlToolCalls.js';

export interface AccumulatedMessage {
  thinking: string;
  content: string;
  toolCalls: XmlToolCall[];
  usage?: UsageInfo;
}
