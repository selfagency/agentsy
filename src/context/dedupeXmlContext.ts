// Max input length guarded to prevent ReDoS on adversarial inputs.
const XML_CONTEXT_MAX_PART_LENGTH = 1_000_000;

// Matches only opening tags — simpler pattern to prevent backtracking.
// JavaScript doesn't support atomic groups, so we use a non-greedy
// quantifier with character classes to limit backtracking.
const OPEN_TAG_RE = /<([a-z_][a-z0-9_.-]{0,50})[^>]*>/gi;

interface TagMatch {
  tagName: string;
  fullMatch: string;
}

// Valid XML tag names: start with letter/underscore, followed by alphanumeric/underscore/hyphen/colon
// Whitelist approach prevents ReDoS by restricting to safe characters only.
const VALID_TAG_NAME = /^[A-Za-z_][A-Za-z0-9_.-:]*$/;

function collectTagMatches(part: string): TagMatch[] {
  if (part.length > XML_CONTEXT_MAX_PART_LENGTH) return [];
  OPEN_TAG_RE.lastIndex = 0;
  const results: TagMatch[] = [];
  for (let m = OPEN_TAG_RE.exec(part); m !== null; m = OPEN_TAG_RE.exec(part)) {
    const tagName = m[1];
    if (!tagName) continue;
    const openEnd = OPEN_TAG_RE.lastIndex;

    // Find the matching closing tag while handling nested tags of the same name.
    // Security: Validate tagName against whitelist before using in RegExp.
    // This prevents ReDoS attacks by ensuring only safe characters are used.
    if (!VALID_TAG_NAME.test(tagName)) continue;

    // tagName is now validated as safe, so no escaping needed.
    const tagRegex = new RegExp(`<(/?)${tagName}\\b[^>]*>`, 'gi');
    tagRegex.lastIndex = openEnd;
    let depth = 1;
    let matchEnd: number | null = null;
    for (let mm = tagRegex.exec(part); mm !== null; mm = tagRegex.exec(part)) {
      const isClose = mm[1] === '/';
      depth += isClose ? -1 : 1;
      if (depth === 0) {
        matchEnd = mm.index + mm[0].length;
        break;
      }
    }
    if (matchEnd === null) continue;
    results.push({ tagName, fullMatch: part.slice(m.index, matchEnd) });
  }
  return results;
}

function dedupeMatchesIntoMap(matches: TagMatch[], latestByTag: Map<string, string>): void {
  // For the current block, pick the longest (outermost) match for each tag
  // and only set it if an entry for that tag hasn't already been recorded
  // by a later block (we iterate blocks from last to first elsewhere).
  const longestByTag = new Map<string, string>();
  for (const match of matches) {
    const existing = longestByTag.get(match.tagName);
    if (!existing || match.fullMatch.length > existing.length) {
      longestByTag.set(match.tagName, match.fullMatch.trim());
    }
  }

  for (const [tagName, fullMatch] of longestByTag) {
    if (!latestByTag.has(tagName)) {
      latestByTag.set(tagName, fullMatch);
    }
  }
}

export function dedupeXmlContextBlocksByTag(blocks: string[]): string[] {
  const latestByTag = new Map<string, string>();

  for (let i = blocks.length - 1; i >= 0; i--) {
    // safe: i bounded by blocks.length
    dedupeMatchesIntoMap(collectTagMatches(blocks[i] ?? ''), latestByTag);
  }

  return [...latestByTag.values()].reverse();
}
