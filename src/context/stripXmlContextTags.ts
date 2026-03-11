import { createXmlStreamFilter } from '../xml-filter/XmlStreamFilter.js';

export function stripXmlContextTags(input: string): string {
  if (!input || !input.includes('<')) {
    return input;
  }

  const filter = createXmlStreamFilter();
  const cleaned = `${filter.write(input)}${filter.end()}`;
  return cleaned.trim();
}
