import { createXmlStreamFilter } from '@agentsy/core/xml-filter';

export function stripXmlContextTags(input: string): string {
  if (!input.includes('<')) {
    return input;
  }

  const filter = createXmlStreamFilter();
  const cleaned = `${filter.write(input)}${filter.end()}`;
  return cleaned;
}
