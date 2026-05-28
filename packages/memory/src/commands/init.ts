import { Command, Flags } from '@oclif/core';
import type { InitResult } from '../init.js';
import { initMemory } from '../init.js';

export default class Init extends Command {
  static readonly description = 'Initialize @agentsy/memory engine and configuration';

  static readonly examples = [
    '<%= config.bin %> init',
    '<%= config.bin %> init --transport http --port 4231',
    '<%= config.bin %> init --skip-mcp --skip-db'
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
    'skip-mcp': Flags.boolean({
      description: 'Skip MCP server creation',
      default: false
    }),
    'skip-db': Flags.boolean({
      description: 'Skip database initialization',
      default: false
    }),
    force: Flags.boolean({
      description: 'Overwrite existing files',
      default: false
    })
  };

  async run(): Promise<InitResult> {
    const { flags } = await this.parse(Init);

    const options = {
      config: {
        mcp: {
          transport: flags.transport as 'stdio' | 'http',
          port: flags.port
        }
      },
      skipMcp: flags['skip-mcp'],
      skipDb: flags['skip-db'],
      force: flags.force
    };

    const result = initMemory(options);

    this.log('✓ @agentsy/memory initialized');
    this.log(
      `  Engine: ${result.engine.stats().totalItems} items, ${(result.engine.stats().budgetUtilization * 100).toFixed(1)}% budget used`
    );
    this.log(`  Config: db=${result.config.db.path}, transport=${result.config.mcp.transport ?? 'stdio'}`);

    if ('server' in result && result.server) {
      this.log('  MCP server created. Call server.start() to begin listening.');
    }

    return result;
  }
}
