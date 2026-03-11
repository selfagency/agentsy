import type { XmlToolCall } from '../tool-calls/extractXmlToolCalls.js';

export interface AccumulatedMessage {
  thinking: string;
  content: string;
  toolCalls: XmlToolCall[];
}
