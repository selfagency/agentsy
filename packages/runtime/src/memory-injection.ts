export interface RuntimeCitation {
  sourceId: string;
  sourceType: string;
  title?: string;
  url?: string;
}

export interface RuntimeMemoryEvidence {
  id: string;
  scope: string;
  score: number;
  title: string;
  content: string;
  citations: RuntimeCitation[];
}

export interface RuntimeMemoryInjectionOptions {
  maxItems?: number;
  maxContentChars?: number;
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function buildRuntimeMemoryContextXml(
  evidence: readonly RuntimeMemoryEvidence[],
  options: RuntimeMemoryInjectionOptions = {}
): string {
  const maxItems = Math.max(1, options.maxItems ?? 8);
  const maxContentChars = Math.max(128, options.maxContentChars ?? 1200);

  const body = evidence
    .slice(0, maxItems)
    .map(item => {
      const citationXml = item.citations
        .map(citation => {
          return `<citation source_id="${escapeXml(citation.sourceId)}" source_type="${escapeXml(citation.sourceType)}"${citation.url ? ` url="${escapeXml(citation.url)}"` : ''}>${escapeXml(citation.title ?? citation.sourceId)}</citation>`;
        })
        .join('');

      return [
        `<memory_item id="${escapeXml(item.id)}" scope="${escapeXml(item.scope)}" score="${item.score.toFixed(3)}">`,
        `<title>${escapeXml(item.title)}</title>`,
        `<content>${escapeXml(item.content.slice(0, maxContentChars))}</content>`,
        `<citations>${citationXml}</citations>`,
        '</memory_item>'
      ].join('');
    })
    .join('');

  return `<memory_context>${body}</memory_context>`;
}

export function injectRuntimeMemoryContext(existingPrompt: string, memoryContextXml: string): string {
  const trimmedExisting = existingPrompt.trimStart();
  if (!trimmedExisting.startsWith('<memory_context>')) {
    return `${memoryContextXml}\n${existingPrompt}`;
  }

  const endIndex = trimmedExisting.indexOf('</memory_context>');
  if (endIndex < 0) {
    return `${memoryContextXml}\n${existingPrompt}`;
  }

  const remainder = trimmedExisting.slice(endIndex + '</memory_context>'.length).trimStart();
  return `${memoryContextXml}${remainder.length > 0 ? `\n${remainder}` : ''}`;
}
