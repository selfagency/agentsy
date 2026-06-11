import type { ToolDefinition } from '../../definitions.js';

export function createHttpTool(): ToolDefinition {
  return {
    name: 'http_fetch',
    description: 'Fetch a URL. Can trigger side effects on external systems.',
    annotations: {
      readOnlyHint: false,
      openWorldHint: true
    },
    parameters: [
      { name: 'url', type: 'string', required: true, description: 'URL to fetch' },
      { name: 'method', type: 'string', required: false, description: 'HTTP method (default: GET)' },
      { name: 'headers', type: 'object', required: false, description: 'Request headers' },
      { name: 'body', type: 'string', required: false, description: 'Request body (POST/PUT)' },
      { name: 'timeout', type: 'number', required: false, description: 'Timeout in ms' }
    ],
    handler: input => {
      const url = typeof input.url === 'string' ? input.url : '';
      if (!url) {
        return { ok: false, data: null, error: 'Missing required parameter: url' };
      }
      return { ok: true, data: { status: 200, body: `[http_fetch placeholder] ${url}`, headers: {} } };
    }
  };
}
