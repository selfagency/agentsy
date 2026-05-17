import { readFile } from 'node:fs/promises';

export interface SourceConnectorOptions {
  web?: {
    enabled?: boolean;
    allowHosts?: string[];
  };
}

export interface SourceConnectors {
  readLocalFile(filePath: string): Promise<string>;
  fetchWebSource(url: string): Promise<string>;
}

function assertAllowedHost(url: URL, allowHosts: readonly string[]): void {
  if (!allowHosts.includes(url.hostname)) {
    throw new Error(`URL host is not in allowlist: ${url.hostname}`);
  }
}

export function createSourceConnectors(options: SourceConnectorOptions): SourceConnectors {
  const webEnabled = options.web?.enabled ?? false;
  const allowHosts = [...(options.web?.allowHosts ?? [])];

  return {
    async fetchWebSource(inputUrl) {
      if (!webEnabled) {
        throw new Error('Web connector is disabled by configuration');
      }

      const parsed = new URL(inputUrl);
      assertAllowedHost(parsed, allowHosts);

      const response = await fetch(parsed.toString());
      if (!response.ok) {
        throw new Error(`Web source request failed with status ${response.status}`);
      }

      response.text();
    },

    async readLocalFile(filePath) {
      return readFile(filePath, 'utf-8');
    }
  };
}
