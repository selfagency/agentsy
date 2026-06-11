import type { Detection } from './types.js';

/**
 * Collect all regex matches from a set of patterns and push them as detections.
 *
 * This is the standard `exec` loop pattern used across multiple scanners.
 * Extracted here to avoid duplicating the 12-line boilerplate.
 */
export function collectRegexMatches(
  input: string,
  patterns: ReadonlyArray<{
    pattern: RegExp;
    id: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    confidence: number;
  }>,
  idPrefix: string
): Detection[] {
  const detections: Detection[] = [];

  for (const { pattern, id, severity, confidence } of patterns) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    // biome-ignore lint/suspicious/noAssignInExpressions: standard exec loop with global regex
    while ((match = pattern.exec(input)) !== null) {
      detections.push({
        id,
        description: `${idPrefix} detected: ${id}`,
        severity,
        confidence,
        start: match.index,
        end: match.index + match[0].length
      });
      if (match.index === pattern.lastIndex) {
        pattern.lastIndex++;
      }
    }
  }

  return detections;
}

/**
 * Reduce a list of detections to the highest severity label.
 */
export function getHighestSeverity(detections: Detection[]): string {
  const order = new Map<string, number>([
    ['low', 1],
    ['medium', 2],
    ['high', 3],
    ['critical', 4]
  ]);
  return detections.reduce<string>((max, d) => {
    const rank = order.get(d.severity) ?? 0;
    const maxRank = order.get(max) ?? 0;
    return rank > maxRank ? d.severity : max;
  }, 'low');
}

/**
 * Sort detections by severity (highest first), then by position.
 */
export function sortDetections(detections: Detection[]): Detection[] {
  const order = new Map<string, number>([
    ['low', 1],
    ['medium', 2],
    ['high', 3],
    ['critical', 4]
  ]);
  return [...detections].sort((a, b) => {
    const sevDiff = (order.get(b.severity) ?? 0) - (order.get(a.severity) ?? 0);
    if (sevDiff !== 0) {
      return sevDiff;
    }
    return (a.start ?? 0) - (b.start ?? 0);
  });
}
