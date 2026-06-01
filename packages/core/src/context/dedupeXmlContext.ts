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

// Valid XML tag names: start with letter/underscore, followed by alphanumeric/underscore/hyphen/dot/colon
// Whitelist approach prevents ReDoS by restricting to safe characters only.
const VALID_TAG_NAME = /^[A-Za-z_][A-Za-z0-9_.:-]*$/;

function isTagBoundary(character: string): boolean {
  return (
    character === '' ||
    character === '>' ||
    character === '/' ||
    character === ' ' ||
    character === '\t' ||
    character === '\n' ||
    character === '\r' ||
    character === '\f'
  );
}

function findNextTagOccurrence(
  part: string,
  tagName: string,
  searchStart: number
): { index: number; isClose: boolean; end: number } | null {
  const openNeedle = `<${tagName}`;
  const closeNeedle = `</${tagName}`;
  let searchIndex = searchStart;

  while (searchIndex < part.length) {
    const nextOpen = part.indexOf(openNeedle, searchIndex);
    const nextClose = part.indexOf(closeNeedle, searchIndex);
    let index = -1;
    let isClose = false;

    const hasClose = nextClose >= 0;
    const hasOpen = nextOpen >= 0;
    const closeComesFirst = hasClose && (!hasOpen || nextClose < nextOpen);

    if (closeComesFirst) {
      index = nextClose;
      isClose = true;
    } else if (hasOpen) {
      index = nextOpen;
    } else {
      return null;
    }

    const afterTagName = index + (isClose ? closeNeedle.length : openNeedle.length);
    const nextChar = part.charAt(afterTagName);

    const isBoundary = nextChar === '' || isTagBoundary(nextChar);
    if (isBoundary) {
      const end = part.indexOf('>', afterTagName);
      if (end === -1) return null;

      return { index, isClose, end: end + 1 };
    }

    searchIndex = afterTagName;
  }

  return null;
}

function findMatchingCloseTag(part: string, tagName: string, searchStart: number): number | null {
  let depth = 1;
  let searchIndex = searchStart;

  while (searchIndex < part.length) {
    const occurrence = findNextTagOccurrence(part, tagName, searchIndex);

    if (occurrence === null) {
      return null;
    }

    depth += occurrence.isClose ? -1 : 1;
    if (depth === 0) {
      return occurrence.end;
    }

    searchIndex = occurrence.end;
  }

  return null;
}

function collectTagMatches(part: string): TagMatch[] {
  if (part.length > XML_CONTEXT_MAX_PART_LENGTH) return [];
  OPEN_TAG_RE.lastIndex = 0;
  const results: TagMatch[] = [];
  for (let m = OPEN_TAG_RE.exec(part); m !== null; m = OPEN_TAG_RE.exec(part)) {
    const tagName = m[1];
    if (!tagName) continue;
    const openEnd = OPEN_TAG_RE.lastIndex;

    // Security: Validate tagName against whitelist before using in RegExp.
    // This prevents ReDoS attacks by ensuring only safe characters are used.
    if (!VALID_TAG_NAME.test(tagName)) continue;

    const matchEnd = findMatchingCloseTag(part, tagName, openEnd);
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

  for (const block of blocks.slice().reverse()) {
    dedupeMatchesIntoMap(collectTagMatches(block), latestByTag);
  }

  return [...latestByTag.values()].reverse();
}
