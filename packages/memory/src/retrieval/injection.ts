export interface MemoryContextCandidate {
  id: string;
  scope: string;
  score: number;
  title?: string;
  content: string;
}

export interface FormatMemoryContextOptions {
  maxItems?: number;
  maxContentChars?: number;
}

export interface XmlContextContracts {
  splitLeadingXmlContextBlocks(input: string): { contextBlocks: string[]; remaining: string };
  dedupeXmlContextBlocksByTag(blocks: string[]): string[];
}

const DEFAULT_MAX_ITEMS = 8;
const DEFAULT_MAX_CONTENT_CHARS = 1200;

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function sanitizeText(value: string): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
}

function splitLeadingXmlContextBlocks(input: string): { contextBlocks: string[]; remaining: string } {
  const blocks: string[] = [];
  let remaining = input.trimStart();
  const blockPattern = /^<(memory_context|[a-z_][a-z0-9_.-]{0,63})[^>]*>[\s\S]*?<\/\1>/iu;

  while (true) {
    const match = remaining.match(blockPattern);
    if (!match || match.index !== 0) {
      break;
    }

    const matchedText = match[0];
    blocks.push(matchedText.trim());
    remaining = remaining.slice(matchedText.length).trimStart();
  }

  return {
    contextBlocks: blocks,
    remaining: blocks.length > 0 ? remaining : input
  };
}

function dedupeXmlContextBlocksByTag(blocks: string[]): string[] {
  const latestByTag = new Map<string, string>();

  for (const block of blocks) {
    const tagMatch = block.match(/^<([a-z_][a-z0-9_.-]{0,63})\b/iu);
    const tag = tagMatch?.[1] ?? `__raw__:${Math.random().toString(36).slice(2)}`;
    latestByTag.set(tag, block.trim());
  }

  return [...latestByTag.values()];
}

const defaultContracts: XmlContextContracts = {
  splitLeadingXmlContextBlocks,
  dedupeXmlContextBlocksByTag
};

export function formatMemoryContextXml(
  candidates: MemoryContextCandidate[],
  options: FormatMemoryContextOptions = {}
): string {
  const maxItems = Math.max(1, options.maxItems ?? DEFAULT_MAX_ITEMS);
  const maxContentChars = Math.max(128, options.maxContentChars ?? DEFAULT_MAX_CONTENT_CHARS);

  const body = candidates
    .slice(0, maxItems)
    .map(candidate => {
      const title = sanitizeText(candidate.title ?? 'memory');
      const content = sanitizeText(candidate.content).slice(0, maxContentChars);
      return [
        `<memory_item id="${escapeXml(candidate.id)}" scope="${escapeXml(candidate.scope)}" score="${candidate.score.toFixed(3)}">`,
        `<title>${escapeXml(title)}</title>`,
        `<content>${escapeXml(content)}</content>`,
        '</memory_item>'
      ].join('');
    })
    .join('');

  return `<memory_context>${body}</memory_context>`;
}

export function injectMemoryContext(
  existingPrompt: string,
  incomingMemoryContext: string,
  contracts: XmlContextContracts = defaultContracts
): string {
  const existing = contracts.splitLeadingXmlContextBlocks(existingPrompt);
  const mergedBlocks = contracts.dedupeXmlContextBlocksByTag([...existing.contextBlocks, incomingMemoryContext]);
  const contextPrefix = mergedBlocks.filter(Boolean).join('\n');

  if (contextPrefix.length === 0) {
    return existingPrompt;
  }

  if (existing.remaining.trim().length === 0) {
    return contextPrefix;
  }

  return `${contextPrefix}\n${existing.remaining}`;
}
