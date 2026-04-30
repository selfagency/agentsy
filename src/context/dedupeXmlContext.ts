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

/**
 * Escape regex special characters in a string for safe use in dynamic RegExp.
 * Prevents ReDoS by ensuring the string is treated literally, not as a pattern.
 */
function escapeRegexChars(str: string): string {
  return str.replace(/[.*+?^${}()|[\\\]]/g, '\\$&');
}

function collectTagMatches(part: string): TagMatch[] {
  if (part.length > XML_CONTEXT_MAX_PART_LENGTH) return [];
  OPEN_TAG_RE.lastIndex = 0;
  const results: TagMatch[] = [];
  for (let m = OPEN_TAG_RE.exec(part); m !== null; m = OPEN_TAG_RE.exec(part)) {
    const tagName = m[1];
    if (!tagName) continue;
    const openEnd = OPEN_TAG_RE.lastIndex;

    // Find the matching closing tag while handling nested tags of the same name.
    // Escape tagName to prevent ReDoS attacks from crafted XML input.
    const escapedTagName = escapeRegexChars(tagName);
    const tagRegex = new RegExp(`<(/?)${escapedTagName}\\b[^>]*>`, 'gi');
    tagRegex.lastIndex = openEnd;
    let depth = 1;
    let matchEnd: number | null = null;
    for (let mm = tagRegex.exec(part); mm !== null; mm = tagRegex.exec(part)) {
      const isClose = mm[1] === '/';
      if (!isClose) {
        depth++;
      } else {
        depth--;
      }
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
    if (!match) continue;
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
    dedupeMatchesIntoMap(collectTagMatches(blocks[i] ?? ''), latestByTag);
  }

  return [...latestByTag.values()].reverse();
}
