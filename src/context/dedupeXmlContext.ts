export function dedupeXmlContextBlocksByTag(blocks: string[]): string[] {
  const xmlContextTagRe = /<([a-zA-Z_][a-zA-Z0-9_.-]*)[^>]*>[\s\S]*?<\/\1>/gi;
  const latestByTag = new Map<string, string>();

  for (let i = blocks.length - 1; i >= 0; i--) {
    const part = blocks[i];
    if (part === undefined) {
      continue;
    }
    xmlContextTagRe.lastIndex = 0;

    const matches: RegExpExecArray[] = [];
    let match: RegExpExecArray | null;
    while ((match = xmlContextTagRe.exec(part)) !== null) {
      matches.push(match);
    }

    for (let j = matches.length - 1; j >= 0; j--) {
      const currentMatch = matches[j];
      if (!currentMatch) {
        continue;
      }
      const tagName = currentMatch[1];
      if (!tagName) {
        continue;
      }
      if (!latestByTag.has(tagName)) {
        latestByTag.set(tagName, currentMatch[0].trim());
      }
    }
  }

  return [...latestByTag.values()].reverse();
}
