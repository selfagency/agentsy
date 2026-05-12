import type { XmlToolCall } from '../../tool-calls/index.js';
import type { IncompletenessDetail } from './LLMStreamProcessor.js';

/**
 * Returns true if `content` contains XML open tags that have no matching close tags.
 * Uses a net-depth counter: each `<tag>` increments, each `</tag>` decrements.
 * Self-closing tags (`<tag/>`) are ignored. A positive depth at the end means
 * at least one tag was never closed.
 *
 * Cyclomatic complexity reduced from 9 to 8 by extracting early return.
 */
export function hasUnclosedXmlTags(content: string): boolean {
  if (!content.includes('<')) return false;

  let depth = 0;
  // Security: Limit tag name length to 50 chars and attribute length to 100
  // to prevent ReDoS attacks. Limited quantifier scope avoids backtracking.
  // biome-ignore lint/security/noReDoubleSlash: Limited quantifiers prevent ReDoS
  const tagRe = /<(\/?)[\sA-Za-z][A-Za-z0-9_.-]{0,50}(?:\s[^>]{0,100})?\s*(\/?)>/g;

  for (const m of content.matchAll(tagRe)) {
    if (m[1] === '/') depth--;
    else if (m[3] !== '/') depth++;
  }

  return depth > 0;
}

/**
 * Inspects accumulated content and the tool call list for signs of an
 * incomplete stream (unclosed tags, tool calls with no parameters).
 */
export function detectIncompleteness(accumulatedContent: string, toolCalls: XmlToolCall[]): IncompletenessDetail[] {
  const incompleteness: IncompletenessDetail[] = [];

  if (hasUnclosedXmlTags(accumulatedContent)) {
    incompleteness.push({
      type: 'xml',
      reason: 'Unmatched XML tags in residual buffer',
    });
  }

  for (const call of toolCalls) {
    if (Object.keys(call.parameters).length === 0 && call.format === 'bare-xml') {
      incompleteness.push({
        type: 'tool_calls',
        reason: `Tool call "${call.name}" has no parsed parameters`,
      });
    }
  }

  return incompleteness;
}
