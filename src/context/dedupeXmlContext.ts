const XML_CONTEXT_TAG_RE = /<([a-z_][a-z0-9_.-]*)[^>]*>[\s\S]*?<\/\1>/gi;

function collectTagMatches(part: string): RegExpExecArray[] {
  XML_CONTEXT_TAG_RE.lastIndex = 0;
  const matches: RegExpExecArray[] = [];
  let match: RegExpExecArray | null;
  while ((match = XML_CONTEXT_TAG_RE.exec(part)) !== null) {
    matches.push(match);
  }
  return matches;
}

function dedupeMatchesIntoMap(matches: RegExpExecArray[], latestByTag: Map<string, string>): void {
  for (let j = matches.length - 1; j >= 0; j--) {
    const currentMatch = matches[j];
    if (!currentMatch) continue;
    const tagName = currentMatch[1];
    if (!tagName) continue;
    if (!latestByTag.has(tagName)) {
      latestByTag.set(tagName, currentMatch[0].trim());
    }
  }
}

export function dedupeXmlContextBlocksByTag(blocks: string[]): string[] {
  const latestByTag = new Map<string, string>();

  for (let i = blocks.length - 1; i >= 0; i--) {
    const part = blocks[i];
    if (part === undefined) continue;
    dedupeMatchesIntoMap(collectTagMatches(part), latestByTag);
  }

  return [...latestByTag.values()].reverse();
}
