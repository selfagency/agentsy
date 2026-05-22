import { Command, Flags } from '@oclif/core';

import { initMemory } from '../init.js';

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

    const result = await initMemory({
      config: {
        mcp: {
          transport: flags.transport as 'stdio' | 'http',
          port: flags.port,
          logLevel: flags['log-level'] as 'debug' | 'info' | 'warn' | 'error'
        }
      }
    });

    this.log(`✓ MCP server ready (${flags.transport})`);
    this.log(`  DB: ${result.config.db.path}`);
    if (result.wiki) this.log('  Wiki: enabled');
    if (result.knowledgeBase) this.log('  Knowledge base: enabled');
    if (result.tursoSyncEngine) this.log('  Turso sync: enabled');

    // Handle graceful shutdown — close server and let process exit naturally.
    // Avoid this.exit() which throws oclif ExitError even for code 0.
    let shuttingDown = false;
    const shutdown = async (): Promise<void> => {
      if (shuttingDown) return;
      shuttingDown = true;
      if ('server' in result) {
        await result.server.close();
      }
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    if ('server' in result) {
      await result.server.start();
    }
  }
}
