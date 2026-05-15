import { describe, expect, it } from 'vitest';

import { createDocumentIngestor } from './document-ingest.js';

describe('DocumentIngestor', () => {
  it('chunks deterministically and preserves stable chunk IDs between runs', async () => {
    const ingestor = createDocumentIngestor();
    const payload = {
      sourceId: 'wiki:oauth-refresh',
      sourceType: 'wiki' as const,
      title: 'OAuth Refresh Tokens',
      content: 'Refresh tokens are long-lived. Access tokens are short-lived. Rotate refresh tokens when possible.'
    };

    const first = await ingestor.ingest(payload);
    const second = await ingestor.ingest(payload);

    expect(first.documents.length).toBeGreaterThan(0);
    expect(first.documents.map(item => item.id)).toEqual(second.documents.map(item => item.id));
  });
});
