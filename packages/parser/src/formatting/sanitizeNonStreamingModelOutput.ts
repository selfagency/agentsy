import { stripXmlContextTags } from '../context/stripXmlContextTags.js';
import { formatXmlLikeResponseForDisplay } from './formatXmlLikeResponseForDisplay.js';

export function sanitizeNonStreamingModelOutput(text: string): string {
  return formatXmlLikeResponseForDisplay(stripXmlContextTags(text));
}
