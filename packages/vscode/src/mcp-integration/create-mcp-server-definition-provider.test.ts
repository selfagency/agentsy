import { describe, expect, it } from 'vitest';
import { createMcpServerDefinitionProvider } from './create-mcp-server-definition-provider.js';

describe('createMcpServerDefinitionProvider', () => {
  it('enriches server definitions with API key env/header values', async () => {
    const provider = createMcpServerDefinitionProvider({
      servers: [
        {
          name: 'zai-mcp',
          command: 'node',
          args: ['server.js'],
          apiKeyEnvVar: 'ZAI_API_KEY',
          apiKeyHeader: 'Authorization',
        },
      ],
      getApiKey: async () => 'secret-key',
      formatApiKeyHeaderValue: apiKey => `Bearer ${apiKey}`,
    });

    const servers = await provider.provide();

    expect(servers).toHaveLength(1);
    expect(servers[0]).toMatchObject({
      name: 'zai-mcp',
      env: { ZAI_API_KEY: 'secret-key' },
      headers: { Authorization: 'Bearer secret-key' },
    });
  });

  it('applies settings-driven disablement per server', async () => {
    const provider = createMcpServerDefinitionProvider({
      servers: [
        {
          name: 'disabled-by-setting',
          command: 'node',
          enabledSettingKey: 'mcp.disabledBySetting.enabled',
        },
      ],
      settings: {
        get: <T>(key: string, fallback?: T): T | undefined => {
          if (key === 'mcp.disabledBySetting.enabled') {
            return false as T;
          }
          return fallback;
        },
      },
    });

    const servers = await provider.provide();

    expect(servers).toHaveLength(1);
    expect(servers[0]?.disabled).toBe(true);
  });
});
