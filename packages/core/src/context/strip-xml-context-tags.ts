import { createXmlStreamFilter } from '../xml-filter/index.js';

export function stripXmlContextTags(input: string): string {
  if (!input.includes('<')) {
    return input;
  }

  const filter = createXmlStreamFilter();
  const cleaned = `${filter.write(input)}${filter.end()}`;
  return cleaned;
}
