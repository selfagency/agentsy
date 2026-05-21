import { stripXmlContextTags } from '../context/strip-xml-context-tags.js';
import { formatXmlLikeResponseForDisplay } from './format-xml-like-response-for-display.js';

export function sanitizeNonStreamingModelOutput(text: string): string {
  return formatXmlLikeResponseForDisplay(stripXmlContextTags(text));
}
