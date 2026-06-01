import { Command, Flags } from '@oclif/core';

import { createMemoryEngine } from '../cognitive/memory-engine.js';
import { loadConfig } from '../config.js';
import { createMemoryMCPServer } from '../mcp/server.js';

export default class Mcp extends Command {
  static readonly description = 'Start the MCP memory server (stdio or http)';

  static readonly examples = [
    '<%= config.bin %> mcp',
    '<%= config.bin %> mcp --transport http --port 4231',
    '<%= config.bin %> mcp --log-level debug'
  ];

  static readonly flags = {
    transport: Flags.string({
      description: 'MCP transport mode',
      options: ['stdio', 'http'],
      default: 'stdio'
    }),
    port: Flags.integer({
      description: 'HTTP port (only used with --transport http)',
      default: 4231
    }),
    'log-level': Flags.string({
      description: 'Log level',
      options: ['debug', 'info', 'warn', 'error'],
      default: 'info'
    })
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Mcp);

    const config = loadConfig({
      mcp: {
        transport: flags.transport as 'stdio' | 'http',
        port: flags.port,
        logLevel: flags['log-level'] as 'debug' | 'info' | 'warn' | 'error'
      }
    });

    const engine = createMemoryEngine();
    const server = createMemoryMCPServer(engine, config.mcp);

    // Handle graceful shutdown
    let shuttingDown = false;
    const shutdown = async (): Promise<void> => {
      if (shuttingDown) {
        return;
      }
      shuttingDown = true;
      await server.close();
      this.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    await server.start();
  }
}
