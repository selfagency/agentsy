import type { ToolDefinition, ToolResult } from '../../definitions.js';

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
    handler: handleHttpFetch
  };
}

async function handleHttpFetch(input: Record<string, unknown>): Promise<ToolResult> {
  const url = typeof input.url === 'string' ? input.url : '';
  if (!url) {
    return { ok: false, data: null, error: 'Missing required parameter: url' };
  }

  const method = typeof input.method === 'string' ? input.method.toUpperCase() : 'GET';
  const timeout = typeof input.timeout === 'number' ? input.timeout : 10_000;
  const headers: Record<string, string> =
    input.headers && typeof input.headers === 'object' ? (input.headers as Record<string, string>) : {};
  const body = typeof input.body === 'string' ? input.body : undefined;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const requestInit: RequestInit = { method, headers, signal: controller.signal };
    if (body !== undefined) {
      requestInit.body = body;
    }

    const response = await fetch(url, requestInit);
    clearTimeout(timer);

    const responseBody = await response.text();
    const responseHeaders: Record<string, string> = Object.fromEntries(response.headers.entries());

    return {
      ok: true,
      data: {
        status: response.status,
        statusText: response.statusText,
        body: responseBody,
        headers: responseHeaders
      }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, data: null, error: `http_fetch error: ${message}` };
  }
}
