// Max input length guarded to prevent ReDoS on adversarial inputs.
const XML_CONTEXT_MAX_PART_LENGTH = 1_000_000;
const XML_CONTEXT_TAG_RE = /<([a-z_][a-z0-9_.-]*)[^>]*>[\s\S]*?<\/\1>/gi;

function collectTagMatches(part: string): RegExpExecArray[] {
  if (part.length > XML_CONTEXT_MAX_PART_LENGTH) return [];
  XML_CONTEXT_TAG_RE.lastIndex = 0;
  const matches: RegExpExecArray[] = [];
  let m: RegExpExecArray | null;
  while ((m = XML_CONTEXT_TAG_RE.exec(part)) !== null) {
    matches.push(m);
  }
  return matches;
}

function dedupeMatchesIntoMap(matches: RegExpExecArray[], latestByTag: Map<string, string>): void {
  for (let j = matches.length - 1; j >= 0; j--) {
    const currentMatch = matches[j];
    const tagName = currentMatch?.[1];
    if (!tagName) continue;
    if (!latestByTag.has(tagName)) {
      latestByTag.set(tagName, currentMatch[0].trim());
    }
  }
}

export function dedupeXmlContextBlocksByTag(blocks: string[]): string[] {
  const latestByTag = new Map<string, string>();

  for (let i = blocks.length - 1; i >= 0; i--) {
    dedupeMatchesIntoMap(collectTagMatches(blocks[i] ?? ''), latestByTag);
  }

  return [...latestByTag.values()].reverse();
}
