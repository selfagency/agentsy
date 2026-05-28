import type { UsageInfo } from '@agentsy/types';

import type { XmlToolCall } from '../../tool-calls/index.js';

export interface AccumulatedMessage {
  content: string;
  thinking: string;
  toolCalls: XmlToolCall[];
  usage?: UsageInfo;
}
