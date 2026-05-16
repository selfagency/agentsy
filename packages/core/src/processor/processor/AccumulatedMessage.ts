import type { UsageInfo } from '@agentsy/types';

import type { XmlToolCall } from '../../tool-calls/index.js';

export interface AccumulatedMessage {
  thinking: string;
  content: string;
  toolCalls: XmlToolCall[];
  usage?: UsageInfo;
}
