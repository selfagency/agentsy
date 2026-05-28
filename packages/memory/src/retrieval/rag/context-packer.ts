import { compressOutput, createTokenLedger } from '@agentsy/tokens';

import type { ContextPackResult, RAGEvidence } from './types.js';

export interface ContextPackerOptions {
  includeCitations?: boolean;
  maxTokens: number;
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export function packEvidenceForContext(
  evidence: readonly RAGEvidence[],
  options: ContextPackerOptions
): ContextPackResult {
  const maxTokens = Math.max(1, options.maxTokens);
  const ledger = createTokenLedger({ limit: maxTokens });
  const packed: ContextPackResult['items'] = [];
  let usedTokens = 0;

  for (const item of evidence) {
    const citations = options.includeCitations ? item.citations : [];
    const compressedContent = compressOutput(item.content, {
      level: 'lite',
      preserve: ['code', 'technical', 'urls', 'paths', 'markdown', 'errors']
    }).compressed;
    const payload = `${item.title}\n${compressedContent}\n${JSON.stringify(citations)}`;
    const cost = estimateTokens(payload);
    if (!ledger.consume(cost)) {
      continue;
    }

    usedTokens += cost;
    packed.push({
      citations,
      content: compressedContent,
      id: item.id,
      score: item.score,
      title: item.title
    });
  }

  return {
    items: packed,
    maxTokens,
    usedTokens
  };
}
