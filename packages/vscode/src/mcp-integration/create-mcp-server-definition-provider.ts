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
  apiKeyEnvVar?: string;
  apiKeyHeader?: string;
  enabledSettingKey?: string;
}

export interface CreateMcpServerDefinitionProviderOptions {
  /** Default environment variable to receive the API key when server-level value is not set. */
  defaultApiKeyEnvVar?: string;
  /** Default HTTP header to receive the API key when server-level value is not set. */
  defaultApiKeyHeader?: string;
  /** Default setting when `enabledSettingKey` is present but unset. */
  defaultEnabled?: boolean;
  /** Format API-key header value. Defaults to raw key value. */
  formatApiKeyHeaderValue?: (apiKey: string) => string;
  /** Optional API key provider for dynamic auth injection. */
  getApiKey?: () => Promise<string | undefined>;
  /** Static list or dynamic resolver for MCP servers. */
  servers:
    | McpProviderServerDefinition[]
    | (() => Promise<McpProviderServerDefinition[]> | McpProviderServerDefinition[]);
  /** Optional settings reader for per-server enable/disable toggles. */
  settings?: McpProviderSettingsReader;
}

const resolveEnabled = (
  server: McpProviderServerDefinition,
  settings: McpProviderSettingsReader | undefined,
  defaultEnabled: boolean
): boolean => {
  if (server.enabledSettingKey === undefined || settings === undefined) {
    return server.disabled !== true;
  }

  const settingValue = settings.get<boolean>(server.enabledSettingKey, defaultEnabled);
  if (typeof settingValue === 'boolean') {
    return settingValue;
  }

  return defaultEnabled;
};

/** Inject API key into server env if a matching env-var key is configured. */
const injectApiKeyIntoEnv = (
  env: Record<string, string>,
  server: McpProviderServerDefinition,
  defaultApiKeyEnvVar: string | undefined,
  apiKey: string
): void => {
  const envKey = server.apiKeyEnvVar ?? defaultApiKeyEnvVar;
  if (typeof envKey === 'string' && envKey.length > 0) {
    env[envKey] = apiKey;
  }
};

/** Inject API key into server headers if a matching header key is configured. */
const injectApiKeyIntoHeaders = (
  headers: Record<string, string>,
  server: McpProviderServerDefinition,
  defaultApiKeyHeader: string | undefined,
  apiKey: string,
  formatHeader: (value: string) => string
): void => {
  const headerKey = server.apiKeyHeader ?? defaultApiKeyHeader;
  if (typeof headerKey === 'string' && headerKey.length > 0) {
    headers[headerKey] = formatHeader(apiKey);
  }
};

/**
 * Conditionally inject the API key into both env and headers for a server.
 * Mutates `env` and `headers` in-place when a key is configured.
 */
const injectApiKey = (
  env: Record<string, string>,
  headers: Record<string, string>,
  server: McpProviderServerDefinition,
  options: {
    defaultApiKeyEnvVar?: string;
    defaultApiKeyHeader?: string;
    formatApiKeyHeaderValue?: (value: string) => string;
  },
  apiKey: string | undefined
): void => {
  if (typeof apiKey !== 'string' || apiKey.length === 0) {
    return;
  }

  const formatHeader = options.formatApiKeyHeaderValue ?? (value => value);
  injectApiKeyIntoEnv(env, server, options.defaultApiKeyEnvVar, apiKey);
  injectApiKeyIntoHeaders(headers, server, options.defaultApiKeyHeader, apiKey, formatHeader);
};

/** Build a plain McpServerDefinition, omitting undefined optionals. */
const buildServerDefinition = (
  server: McpProviderServerDefinition,
  env: Record<string, string>,
  headers: Record<string, string>,
  enabled: boolean
): McpServerDefinition => {
  const definition: McpServerDefinition = {
    command: server.command,
    name: server.name
  };

  if (server.args !== undefined) {
    definition.args = server.args;
  }

  if (Object.keys(env).length > 0) {
    definition.env = env;
  }

  if (Object.keys(headers).length > 0) {
    definition.headers = headers;
  }

  if (server.alwaysAllow) {
    definition.alwaysAllow = true;
  }

  if (!enabled) {
    definition.disabled = true;
  }

  return definition;
};

const provideServerDefinitions = async (
  options: CreateMcpServerDefinitionProviderOptions
): Promise<McpServerDefinition[]> => {
  const defaultEnabled = options.defaultEnabled ?? true;
  const rawServers = typeof options.servers === 'function' ? await options.servers() : options.servers;
  const apiKey = await options.getApiKey?.();

  return rawServers.map(server => {
    const enabled = resolveEnabled(server, options.settings, defaultEnabled);
    const env: Record<string, string> = { ...server.env };
    const headers: Record<string, string> = { ...server.headers };

    injectApiKey(env, headers, server, options, apiKey);

    return buildServerDefinition(server, env, headers, enabled);
  });
};

/**
 * Creates an MCP server-definition provider with built-in auth and settings enrichment.
 */
export const createMcpServerDefinitionProvider = (
  options: CreateMcpServerDefinitionProviderOptions
): McpServerProvider => ({
  provide: () => provideServerDefinitions(options)
});
