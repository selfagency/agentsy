function extractFirstXmlTagName(block: string): string | null {
  const match = block.match(/<([A-Za-z_][\w\-.]*)[>\s]/);
  return match?.[1] ?? null;
}

export function dedupeXmlContextBlocksByTag(blocks: string[]): string[] {
  const seenTags = new Set<string>();
  const result: string[] = [];

  for (const block of blocks) {
    const tagName = extractFirstXmlTagName(block);

    if (tagName === null) {
      result.push(block);
      continue;
    }

    if (!seenTags.has(tagName)) {
      seenTags.add(tagName);
      result.push(block);
    }
  }

  return result;
}
