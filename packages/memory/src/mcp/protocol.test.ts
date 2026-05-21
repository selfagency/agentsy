import { describe, it, expect } from 'vitest';

import { createMcpServer, MCP_PROTOCOL_VERSION, type JsonRpcResponse, type McpNotification } from './protocol.js';

function assertErrorResponse(
  response: JsonRpcResponse | McpNotification | undefined
): asserts response is JsonRpcResponse {
  expect(response).toBeDefined();
  expect('error' in (response as object)).toBe(true);
}

function assertResultResponse(
  response: JsonRpcResponse | McpNotification | undefined
): asserts response is JsonRpcResponse {
  expect(response).toBeDefined();
  expect('result' in (response as object)).toBe(true);
}

describe('MCP Protocol', () => {
  it('should initialize successfully', async () => {
    const server = createMcpServer({
      name: 'test-server',
      version: '1.0.0',
      tools: {}
    });

    const response = await server.handleMessage({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize'
    });

    assertResultResponse(response);
    const result = response.result as Record<string, unknown>;
    expect(result.protocolVersion).toBe(MCP_PROTOCOL_VERSION);
    expect(result.serverInfo).toEqual({
      name: 'test-server',
      version: '1.0.0'
    });
  });

  it('should list tools after initialization', async () => {
    const server = createMcpServer({
      name: 'test-server',
      version: '1.0.0',
      tools: {
        test_tool: {
          definition: {
            name: 'test_tool',
            description: 'A test tool',
            inputSchema: { type: 'object', properties: {} }
          },
          handler: async () => ({
            content: [{ type: 'text', text: 'ok' }]
          })
        }
      }
    });

    await server.handleMessage({ jsonrpc: '2.0', id: 1, method: 'initialize' });

    const response = await server.handleMessage({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list'
    });

    assertResultResponse(response);
    const result = response.result as { tools: Array<{ name: string }> };
    expect(result.tools).toHaveLength(1);
    const firstTool = result.tools[0];
    expect(firstTool).toBeDefined();
    expect(firstTool?.name).toBe('test_tool');
  });

  it('should call a tool successfully', async () => {
    const server = createMcpServer({
      name: 'test-server',
      version: '1.0.0',
      tools: {
        echo: {
          definition: {
            name: 'echo',
            description: 'Echo back the input',
            inputSchema: {
              type: 'object',
              properties: { message: { type: 'string' } }
            }
          },
          handler: async args => ({
            content: [{ type: 'text', text: String(args.message) }]
          })
        }
      }
    });

    await server.handleMessage({ jsonrpc: '2.0', id: 1, method: 'initialize' });

    const response = await server.handleMessage({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'echo', arguments: { message: 'hello' } }
    });

    assertResultResponse(response);
    const result = response.result as {
      content: Array<{ type: string; text: string }>;
    };
    const firstContent = result.content[0];
    expect(firstContent).toBeDefined();
    expect(firstContent?.text).toBe('hello');
  });

  it('should return error for unknown tool', async () => {
    const server = createMcpServer({
      name: 'test-server',
      version: '1.0.0',
      tools: {}
    });

    await server.handleMessage({ jsonrpc: '2.0', id: 1, method: 'initialize' });

    const response = await server.handleMessage({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'nonexistent', arguments: {} }
    });

    assertErrorResponse(response);
    expect(response.error?.code).toBe(-32601);
  });

  it('should return error for method not found', async () => {
    const server = createMcpServer({
      name: 'test-server',
      version: '1.0.0',
      tools: {}
    });

    const response = await server.handleMessage({
      jsonrpc: '2.0',
      id: 1,
      method: 'nonexistent/method'
    });

    assertErrorResponse(response);
    expect(response.error?.code).toBe(-32601);
  });

  it('should reject tools/list before initialization', async () => {
    const server = createMcpServer({
      name: 'test-server',
      version: '1.0.0',
      tools: {}
    });

    const response = await server.handleMessage({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list'
    });

    assertErrorResponse(response);
    expect(response.error?.code).toBe(-32001);
  });

  it('should report capabilities', () => {
    const server = createMcpServer({
      name: 'test-server',
      version: '1.0.0',
      tools: {}
    });

    const caps = server.capabilities();
    expect(caps).toHaveProperty('tools');
    expect(caps).toHaveProperty('logging');
  });

  it('should close and reset initialization state', async () => {
    const server = createMcpServer({
      name: 'test-server',
      version: '1.0.0',
      tools: {}
    });

    await server.handleMessage({ jsonrpc: '2.0', id: 1, method: 'initialize' });
    server.close();

    const response = await server.handleMessage({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list'
    });

    assertErrorResponse(response);
    expect(response.error?.code).toBe(-32001);
  });

  it('should handle tool call errors', async () => {
    const server = createMcpServer({
      name: 'test-server',
      version: '1.0.0',
      tools: {
        fail_tool: {
          definition: {
            name: 'fail_tool',
            description: 'A tool that throws',
            inputSchema: { type: 'object', properties: {} }
          },
          handler: async () => {
            throw new Error('Tool failed');
          }
        }
      }
    });

    await server.handleMessage({ jsonrpc: '2.0', id: 1, method: 'initialize' });

    const response = await server.handleMessage({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'fail_tool', arguments: {} }
    });

    assertErrorResponse(response);
    expect(response.error?.message).toBe('Tool failed');
  });

  it('should return error for missing tool name in call', async () => {
    const server = createMcpServer({
      name: 'test-server',
      version: '1.0.0',
      tools: {}
    });

    await server.handleMessage({ jsonrpc: '2.0', id: 1, method: 'initialize' });

    const response = await server.handleMessage({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { arguments: {} }
    });

    assertErrorResponse(response);
    expect(response.error?.code).toBe(-32602);
  });

  it('should handle initialized notification', async () => {
    const server = createMcpServer({
      name: 'test-server',
      version: '1.0.0',
      tools: {}
    });

    const response = await server.handleMessage({
      jsonrpc: '2.0',
      method: 'initialized'
    });

    expect(response).toBeUndefined();
  });

  it('should handle notifications/initialized', async () => {
    const server = createMcpServer({
      name: 'test-server',
      version: '1.0.0',
      tools: {}
    });

    const response = await server.handleMessage({
      jsonrpc: '2.0',
      method: 'notifications/initialized'
    });

    expect(response).toBeUndefined();
  });
});
