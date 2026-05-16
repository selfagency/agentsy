import type { McpServerDefinition, McpServerProvider } from '../types/errors.js';

/** Minimal settings-reader contract compatible with SettingsLoader#get. */
export interface McpProviderSettingsReader {
  get<T>(key: string, fallback?: T): T | undefined;
}

/**
 * Extended MCP server definition accepted by createMcpServerDefinitionProvider.
 *
 * `enabledSettingKey` allows per-server enable/disable toggles from settings.
 */
export interface McpProviderServerDefinition extends McpServerDefinition {
  enabledSettingKey?: string;
  apiKeyEnvVar?: string;
  apiKeyHeader?: string;
}

export interface CreateMcpServerDefinitionProviderOptions {
  /** Static list or dynamic resolver for MCP servers. */
  servers:
    | McpProviderServerDefinition[]
    | (() => Promise<McpProviderServerDefinition[]> | McpProviderServerDefinition[]);
  /** Optional settings reader for per-server enable/disable toggles. */
  settings?: McpProviderSettingsReader;
  /** Optional API key provider for dynamic auth injection. */
  getApiKey?: () => Promise<string | undefined>;
  /** Default setting when `enabledSettingKey` is present but unset. */
  defaultEnabled?: boolean;
  /** Default environment variable to receive the API key when server-level value is not set. */
  defaultApiKeyEnvVar?: string;
  /** Default HTTP header to receive the API key when server-level value is not set. */
  defaultApiKeyHeader?: string;
  /** Format API-key header value. Defaults to raw key value. */
  formatApiKeyHeaderValue?: (apiKey: string) => string;
}

function resolveEnabled(
  server: McpProviderServerDefinition,
  settings: McpProviderSettingsReader | undefined,
  defaultEnabled: boolean
): boolean {
  if (server.enabledSettingKey === undefined || settings === undefined) {
    return server.disabled !== true;
  }

  const settingValue = settings.get<boolean>(server.enabledSettingKey, defaultEnabled);
  if (typeof settingValue === 'boolean') {
    return settingValue;
  }

  return defaultEnabled;
}

/**
 * Creates an MCP server-definition provider with built-in auth and settings enrichment.
 */
export function createMcpServerDefinitionProvider(
  options: CreateMcpServerDefinitionProviderOptions
): McpServerProvider {
  const defaultEnabled = options.defaultEnabled ?? true;
  const formatHeader = options.formatApiKeyHeaderValue ?? (apiKey => apiKey);

  return {
    async provide(): Promise<McpServerDefinition[]> {
      const rawServers = typeof options.servers === 'function' ? await options.servers() : options.servers;
      const apiKey = await options.getApiKey?.();

      return rawServers.map(server => {
        const enabled = resolveEnabled(server, options.settings, defaultEnabled);

        const env = { ...server.env };
        const headers = { ...server.headers };

        if (typeof apiKey === 'string' && apiKey.length > 0) {
          const envKey = server.apiKeyEnvVar ?? options.defaultApiKeyEnvVar;
          if (typeof envKey === 'string' && envKey.length > 0) {
            env[envKey] = apiKey;
          }

          const headerKey = server.apiKeyHeader ?? options.defaultApiKeyHeader;
          if (typeof headerKey === 'string' && headerKey.length > 0) {
            headers[headerKey] = formatHeader(apiKey);
          }
        }

        const enriched: McpServerDefinition = {
          command: server.command,
          name: server.name,
          ...(server.args === undefined ? {} : { args: server.args }),
          ...(Object.keys(env).length > 0 ? { env } : {}),
          ...(Object.keys(headers).length > 0 ? { headers } : {}),
          ...(server.alwaysAllow ? { alwaysAllow: true } : {}),
          ...(enabled ? {} : { disabled: true })
        };

        return enriched;
      });
    }
  };
}
