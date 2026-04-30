// Max input length guarded to prevent ReDoS on adversarial inputs.
const XML_CONTEXT_MAX_PART_LENGTH = 1_000_000;

// Matches only opening tags — no backreference, no super-linear backtracking.
const OPEN_TAG_RE = /<([a-z_][a-z0-9_.-]*)[^>]*>/gi;

interface TagMatch {
  tagName: string;
  fullMatch: string;
}

function collectTagMatches(part: string): TagMatch[] {
  if (part.length > XML_CONTEXT_MAX_PART_LENGTH) return [];
  OPEN_TAG_RE.lastIndex = 0;
  const results: TagMatch[] = [];
  for (let m = OPEN_TAG_RE.exec(part); m !== null; m = OPEN_TAG_RE.exec(part)) {
    const tagName = m[1];
    if (!tagName) continue;
    const openEnd = OPEN_TAG_RE.lastIndex;
    const closeTag = `</${tagName}>`;
    const closeIdx = part.indexOf(closeTag, openEnd);
    if (closeIdx === -1) continue;
    results.push({ tagName, fullMatch: part.slice(m.index, closeIdx + closeTag.length) });
  }
  return results;
}

function dedupeMatchesIntoMap(matches: TagMatch[], latestByTag: Map<string, string>): void {
  for (let j = matches.length - 1; j >= 0; j--) {
    const match = matches[j];
    if (!match) continue;
    if (!latestByTag.has(match.tagName)) {
      latestByTag.set(match.tagName, match.fullMatch.trim());
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
