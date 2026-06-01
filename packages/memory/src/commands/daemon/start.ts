import { Command, Flags } from '@oclif/core';

import { startDaemon } from '../../mcp/daemon.js';

export default class DaemonStart extends Command {
  static readonly description = 'Start the memory daemon with auto-restart';

  static readonly examples = [
    '<%= config.bin %> daemon:start',
    '<%= config.bin %> daemon:start --transport http --port 4231',
    '<%= config.bin %> daemon:start --no-restart'
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
    }),
    'no-restart': Flags.boolean({
      description: 'Disable auto-restart on crash',
      default: false
    }),
    'max-restarts': Flags.integer({
      description: 'Max restarts within the restart window',
      default: 5
    }),
    'restart-delay': Flags.integer({
      description: 'Delay between restarts in milliseconds',
      default: 1000
    })
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(DaemonStart);

    await startDaemon(
      {
        transport: flags.transport as 'stdio' | 'http',
        port: flags.port,
        logLevel: flags['log-level'] as 'debug' | 'info' | 'warn' | 'error'
      },
      {
        restart: !flags['no-restart'],
        maxRestarts: flags['max-restarts'],
        restartDelay: flags['restart-delay']
      }
    );
  }
}
