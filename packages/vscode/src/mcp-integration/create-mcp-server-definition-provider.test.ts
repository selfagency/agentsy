import { describe, expect, it } from 'vitest';

import { createMcpServerDefinitionProvider } from './create-mcp-server-definition-provider.js';

describe(createMcpServerDefinitionProvider, () => {
  it('enriches server definitions with API key env/header values', async () => {
    const provider = createMcpServerDefinitionProvider({
      formatApiKeyHeaderValue: apiKey => `Bearer ${apiKey}`,
      getApiKey: async () => 'secret-key',
      servers: [
        {
          apiKeyEnvVar: 'ZAI_API_KEY',
          apiKeyHeader: 'Authorization',
          args: ['server.js'],
          command: 'node',
          name: 'zai-mcp'
        }
      ]
    });

    const servers = await provider.provide();

    expect(servers).toHaveLength(1);
    expect(servers[0]).toMatchObject({
      env: { ZAI_API_KEY: 'secret-key' },
      headers: { Authorization: 'Bearer secret-key' },
      name: 'zai-mcp'
    });
  });

  it('applies settings-driven disablement per server', async () => {
    const provider = createMcpServerDefinitionProvider({
      servers: [
        {
          command: 'node',
          enabledSettingKey: 'mcp.disabledBySetting.enabled',
          name: 'disabled-by-setting'
        }
      ],
      settings: {
        get: <T>(key: string, fallback?: T): T | undefined => {
          if (key === 'mcp.disabledBySetting.enabled') {
            return false as T;
          }
          return fallback;
        }
      }
    });

    const servers = await provider.provide();

    expect(servers).toHaveLength(1);
    expect(servers[0]?.disabled).toBeTruthy();
  });
});
