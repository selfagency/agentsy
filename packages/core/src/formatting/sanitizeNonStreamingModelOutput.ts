import { stripXmlContextTags } from '@agentsy/core/context';
import { formatXmlLikeResponseForDisplay } from './formatXmlLikeResponseForDisplay.js';

export function sanitizeNonStreamingModelOutput(text: string): string {
  return formatXmlLikeResponseForDisplay(stripXmlContextTags(text));
}
